import { spawn } from 'node:child_process'
import type { ChildProcess, StdioOptions } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'
import { RUNTIME } from '@func/contracts/process-errors'
import type { OnDispose } from '../../di/lifecycle'
import type { Context } from '../../runtime/context'
import { environment } from '../../shared/environment'
import { ErrorScope, Exception } from '../../shared/errors'
import type {
  ProcessCaptureOptions,
  ProcessCaptureResult,
  ProcessExceptionOptions,
  ProcessFailureResult,
  ProcessForwardOptions,
  ProcessOptions,
  ProcessStatus,
} from './interfaces'

const defaultMaxOutputBytes = 10 * 1024 * 1024
const terminationGraceMs = 3_000

type TerminationReason = 'aborted' | 'output-limit' | 'timeout'

interface ProcessBinding {
  children: Set<ManagedChild>
  context: Context
}

interface ProcessExit {
  error?: Error
  exitCode: number | null
  signal: NodeJS.Signals | null
}

interface ManagedChild {
  readonly child: ChildProcess
  readonly closed: Promise<ProcessExit>
  readonly reason: TerminationReason | undefined
  terminate(reason: TerminationReason): void
}

interface NormalizedOptions {
  acceptedExitCodes: ReadonlySet<number>
  args: readonly string[]
  cwd: string
  env: Readonly<Record<string, string | undefined>>
  executable: string
  label: string
  sensitive: boolean
  signal: AbortSignal
  timeoutMs?: number
}

interface CaptureState {
  readonly encoding: BufferEncoding
  readonly maxOutputBytes: number
  readonly stderr: Buffer[]
  readonly stdout: Buffer[]
  bytes: number
}

interface CapturedProcessFailureResult extends ProcessFailureResult {
  stderr: string
  stdout: string
}

type AssertSuccessfulExit = (
  exit: ProcessExit,
  reason: TerminationReason | undefined,
  options: NormalizedOptions,
  result: ProcessFailureResult,
) => asserts exit is ProcessExit & { exitCode: number }

const processStates = new WeakMap<FuncProcess, ProcessBinding>()

export class ProcessException extends Exception<RUNTIME> {
  readonly result?: ProcessFailureResult

  constructor(code: RUNTIME, options: ProcessExceptionOptions | string = {}) {
    const normalized = typeof options === 'string' ? { message: options } : options
    super(code, {
      ...normalized,
      name: 'ProcessException',
      scope: ErrorScope.RUNTIME,
    })
    this.result = normalized.result
  }
}

export class FuncProcess implements OnDispose {
  capture(
    executable: string,
    args: readonly string[] = [],
    options: ProcessCaptureOptions = {},
  ): Promise<ProcessCaptureResult> {
    return executeCapture(processState(this), executable, args, options)
  }

  forward(
    executable: string,
    args: readonly string[] = [],
    options: ProcessForwardOptions = {},
  ): Promise<ProcessStatus> {
    return executeForward(processState(this), executable, args, options)
  }

  async onDispose(): Promise<void> {
    const state = processStates.get(this)
    if (!state) return
    const children = Array.from(state.children)
    children.forEach(child => child.terminate('aborted'))
    await Promise.all(children.map(child => child.closed))
    state.children.clear()
  }
}

export const bindFuncProcess = (
  instance: FuncProcess,
  context: Context,
): FuncProcess => {
  processStates.set(instance, {
    children: new Set(),
    context,
  })
  return instance
}

const executeCapture = async (
  binding: ProcessBinding,
  executable: string,
  args: readonly string[],
  options: ProcessCaptureOptions,
): Promise<ProcessCaptureResult> => {
  const normalized = normalizeOptions(binding, executable, args, options)
  const capture = captureState(options)
  const startedAt = Date.now()
  assertNotAborted(normalized)
  const child = spawnProcess(normalized, 'pipe')
  const managed = manageChild(child)
  binding.children.add(managed)
  const cleanup = attachControl(managed, normalized)
  attachCapture(managed, capture)
  writeInput(child, options.input)

  try {
    const exit = await managed.closed
    const result = capturedResult(capture, exit, startedAt)
    throwIfOutputLimit(managed.reason, capture, normalized, result)
    assertSuccessfulExit(exit, managed.reason, normalized, result)
    return {
      durationMs: result.durationMs,
      exitCode: exit.exitCode,
      stderr: result.stderr,
      stdout: result.stdout,
    }
  } finally {
    cleanup()
    binding.children.delete(managed)
  }
}

const executeForward = async (
  binding: ProcessBinding,
  executable: string,
  args: readonly string[],
  options: ProcessForwardOptions,
): Promise<ProcessStatus> => {
  const normalized = normalizeOptions(binding, executable, args, options)
  const startedAt = Date.now()
  assertNotAborted(normalized)
  const child = spawnProcess(normalized, forwardStdio(binding.context))
  const managed = manageChild(child)
  binding.children.add(managed)
  const cleanupControl = attachControl(managed, normalized)
  const cleanupStreams = forwardStreams(child, binding.context)

  try {
    const exit = await managed.closed
    const result: ProcessFailureResult = {
      durationMs: Date.now() - startedAt,
      exitCode: exit.exitCode,
      signal: exit.signal,
    }
    assertSuccessfulExit(exit, managed.reason, normalized, result)
    return {
      durationMs: result.durationMs,
      exitCode: exit.exitCode,
    }
  } finally {
    cleanupStreams()
    cleanupControl()
    binding.children.delete(managed)
  }
}

const normalizeOptions = (
  binding: ProcessBinding,
  executable: string,
  args: readonly string[],
  options: ProcessOptions,
): NormalizedOptions => {
  assertExecutable(executable)
  const normalizedArgs = normalizeArgs(args)
  const cwd = options.cwd ?? binding.context.cwd
  if (typeof cwd !== 'string' || !cwd.length || cwd.includes('\0')) {
    throw invalidProcessOptions(
      'cwd',
      cwd,
      'Process cwd must be a non-empty path without NUL bytes.',
    )
  }
  if (
    options.label !== undefined &&
    (typeof options.label !== 'string' ||
      !options.label.length ||
      options.label.includes('\0'))
  ) {
    throw invalidProcessOptions(
      'label',
      options.label,
      'Process label must be a non-empty string without NUL bytes.',
    )
  }
  if (options.sensitive !== undefined && typeof options.sensitive !== 'boolean') {
    throw invalidProcessOptions(
      'sensitive',
      options.sensitive,
      'Process sensitive must be a boolean.',
    )
  }
  if (
    options.timeoutMs !== undefined &&
    (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0)
  ) {
    throw invalidProcessOptions(
      'timeoutMs',
      options.timeoutMs,
      'Process timeoutMs must be a positive safe integer.',
    )
  }
  if (
    options.acceptedExitCodes !== undefined &&
    !Array.isArray(options.acceptedExitCodes)
  ) {
    throw invalidProcessOptions(
      'acceptedExitCodes',
      options.acceptedExitCodes,
      'Process acceptedExitCodes must be an array.',
    )
  }
  const acceptedExitCodes = new Set(options.acceptedExitCodes ?? [0])
  if (
    !acceptedExitCodes.size ||
    Array.from(acceptedExitCodes).some(
      code => !Number.isSafeInteger(code) || code < 0,
    )
  ) {
    throw invalidProcessOptions(
      'acceptedExitCodes',
      options.acceptedExitCodes,
      'Process acceptedExitCodes must contain non-negative safe integers.',
    )
  }
  const signal = options.signal
    ? AbortSignal.any([binding.context.signal, options.signal])
    : binding.context.signal

  return {
    acceptedExitCodes,
    args: normalizedArgs,
    cwd,
    env:
      options.env === undefined
        ? binding.context.env
        : environment.normalize(options.env),
    executable,
    label: options.label ?? executable,
    sensitive: options.sensitive ?? false,
    signal,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  }
}

const assertExecutable = (executable: string) => {
  if (
    typeof executable === 'string' &&
    executable.length &&
    !executable.includes('\0')
  )
    return
  throw invalidProcessOptions(
    'executable',
    executable,
    'Process executable must be a non-empty string without NUL bytes.',
  )
}

const normalizeArgs = (args: unknown): readonly string[] => {
  if (!Array.isArray(args)) {
    throw invalidProcessOptions(
      'args',
      args,
      'Process args must be an array of strings.',
    )
  }
  const values: unknown[] = args
  const strings = values.filter(
    (value): value is string => typeof value === 'string',
  )
  if (strings.length !== values.length) {
    throw invalidProcessOptions(
      'args',
      args,
      'Process args must be an array of strings.',
    )
  }
  if (strings.some(arg => arg.includes('\0'))) {
    throw invalidProcessOptions(
      'args',
      args,
      'Process args cannot contain NUL bytes.',
    )
  }
  return Object.freeze(strings)
}

const captureState = (options: ProcessCaptureOptions): CaptureState => {
  const encoding = options.encoding ?? 'utf8'
  if (!Buffer.isEncoding(encoding)) {
    throw invalidProcessOptions(
      'encoding',
      encoding,
      'Process encoding must be a supported Buffer encoding.',
    )
  }
  const maxOutputBytes = options.maxOutputBytes ?? defaultMaxOutputBytes
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0) {
    throw invalidProcessOptions(
      'maxOutputBytes',
      maxOutputBytes,
      'Process maxOutputBytes must be a positive safe integer.',
    )
  }
  if (
    options.input !== undefined &&
    typeof options.input !== 'string' &&
    !(options.input instanceof Uint8Array)
  ) {
    throw invalidProcessOptions(
      'input',
      options.input,
      'Process input must be a string or Uint8Array.',
    )
  }

  return {
    bytes: 0,
    encoding,
    maxOutputBytes,
    stderr: [],
    stdout: [],
  }
}

const assertNotAborted = (options: NormalizedOptions) => {
  if (!options.signal.aborted) return
  throw processError(RUNTIME.ABORTED, options, 'was aborted before it started')
}

const spawnProcess = (
  options: NormalizedOptions,
  stdio: StdioOptions,
): ChildProcess => {
  try {
    return spawn(options.executable, options.args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio,
      windowsHide: true,
    })
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error))
    throw processError(RUNTIME.SPAWN, options, 'could not be started', {
      cause,
    })
  }
}

const forwardStdio = (context: Context): StdioOptions => [
  streamFileDescriptor(context.io.stdin) ?? 'pipe',
  streamFileDescriptor(context.io.stdout) ?? 'pipe',
  streamFileDescriptor(context.io.stderr) ?? 'pipe',
]

const streamFileDescriptor = (stream: Readable | Writable): number | undefined => {
  const value: unknown = Reflect.get(stream, 'fd')
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined
}

const manageChild = (child: ChildProcess): ManagedChild => {
  let forceTimer: NodeJS.Timeout | undefined
  let reason: TerminationReason | undefined
  let settled = false
  let settle: (exit: ProcessExit) => void
  const closed = new Promise<ProcessExit>(resolve => {
    settle = resolve
  })
  const complete = (exit: ProcessExit) => {
    if (settled) return
    settled = true
    if (forceTimer) clearTimeout(forceTimer)
    settle(exit)
  }
  child.once('error', error => {
    complete({
      error,
      exitCode: child.exitCode,
      signal: child.signalCode,
    })
  })
  child.once('close', (exitCode, signal) => {
    complete({ exitCode, signal })
  })

  return {
    child,
    closed,
    get reason() {
      return reason
    },
    terminate(nextReason) {
      reason ??= nextReason
      if (settled || child.exitCode !== null || child.signalCode !== null) return
      try {
        if (!child.kill('SIGTERM')) return
      } catch {
        return
      }
      forceTimer ??= setTimeout(() => {
        if (settled || child.exitCode !== null || child.signalCode !== null) return
        try {
          child.kill('SIGKILL')
        } catch {
          // The process may have exited between the state check and kill.
        }
      }, terminationGraceMs)
      forceTimer.unref()
    },
  }
}

const attachControl = (
  managed: ManagedChild,
  options: NormalizedOptions,
): (() => void) => {
  const abort = () => managed.terminate('aborted')
  options.signal.addEventListener('abort', abort, { once: true })
  const timeout = options.timeoutMs
    ? setTimeout(() => managed.terminate('timeout'), options.timeoutMs)
    : undefined
  timeout?.unref()
  if (options.signal.aborted) abort()

  return () => {
    options.signal.removeEventListener('abort', abort)
    if (timeout) clearTimeout(timeout)
  }
}

const attachCapture = (managed: ManagedChild, capture: CaptureState) => {
  const append = (chunks: Buffer[], input: string | Buffer) => {
    const chunk = Buffer.from(input)
    const remaining = Math.max(0, capture.maxOutputBytes - capture.bytes)
    if (remaining) chunks.push(chunk.subarray(0, remaining))
    capture.bytes += chunk.byteLength
    if (capture.bytes > capture.maxOutputBytes) {
      managed.terminate('output-limit')
    }
  }
  managed.child.stdout?.on('data', (chunk: string | Buffer) =>
    append(capture.stdout, chunk),
  )
  managed.child.stderr?.on('data', (chunk: string | Buffer) =>
    append(capture.stderr, chunk),
  )
}

const writeInput = (child: ChildProcess, input: string | Uint8Array | undefined) => {
  if (!child.stdin) return
  child.stdin.on('error', () => {
    // A process may close stdin before consuming all input.
  })
  child.stdin.end(input)
}

const forwardStreams = (child: ChildProcess, context: Context): (() => void) => {
  if (child.stdin) {
    child.stdin.on('error', () => {
      // A process may exit while invocation input is still open.
    })
    context.io.stdin.pipe(child.stdin)
  }
  if (child.stdout) child.stdout.pipe(context.io.stdout, { end: false })
  if (child.stderr) child.stderr.pipe(context.io.stderr, { end: false })

  return () => {
    if (child.stdin) context.io.stdin.unpipe(child.stdin)
    if (child.stdout) child.stdout.unpipe(context.io.stdout)
    if (child.stderr) child.stderr.unpipe(context.io.stderr)
  }
}

const capturedResult = (
  capture: CaptureState,
  exit: ProcessExit,
  startedAt: number,
): CapturedProcessFailureResult => ({
  durationMs: Date.now() - startedAt,
  exitCode: exit.exitCode,
  signal: exit.signal,
  stderr: Buffer.concat(capture.stderr).toString(capture.encoding),
  stdout: Buffer.concat(capture.stdout).toString(capture.encoding),
})

const throwIfOutputLimit = (
  reason: TerminationReason | undefined,
  capture: CaptureState,
  options: NormalizedOptions,
  result: ProcessFailureResult,
) => {
  if (reason !== 'output-limit') return
  throw processError(
    RUNTIME.OUTPUT_LIMIT,
    options,
    `exceeded the ${capture.maxOutputBytes} byte output limit`,
    { result },
  )
}

const assertSuccessfulExit: AssertSuccessfulExit = (
  exit: ProcessExit,
  reason: TerminationReason | undefined,
  options: NormalizedOptions,
  result: ProcessFailureResult,
): asserts exit is ProcessExit & { exitCode: number } => {
  if (reason === 'aborted') {
    throw processError(RUNTIME.ABORTED, options, 'was aborted', { result })
  }
  if (reason === 'timeout') {
    throw processError(
      RUNTIME.TIMEOUT,
      options,
      `timed out after ${options.timeoutMs}ms`,
      { result },
    )
  }
  if (exit.error) throw spawnError(exit.error, options, result)
  if (exit.signal) {
    throw processError(RUNTIME.SIGNAL, options, `was terminated by ${exit.signal}`, {
      result,
    })
  }
  if (exit.exitCode === null) {
    throw processError(RUNTIME.SPAWN, options, 'ended without an exit code', {
      result,
    })
  }
  if (options.acceptedExitCodes.has(exit.exitCode)) return
  throw processError(RUNTIME.EXIT, options, `exited with code ${exit.exitCode}`, {
    result,
  })
}

const spawnError = (
  cause: Error,
  options: NormalizedOptions,
  result: ProcessFailureResult,
): ProcessException => {
  const code = 'code' in cause ? cause.code : undefined
  if (code === 'ENOENT') {
    return processError(RUNTIME.NOT_FOUND, options, 'could not be found', {
      cause,
      result,
    })
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return processError(
      RUNTIME.PERMISSION_DENIED,
      options,
      'could not be executed due to insufficient permissions',
      { cause, result },
    )
  }
  return processError(RUNTIME.SPAWN, options, 'could not be started', {
    cause,
    result,
  })
}

const invalidProcessOptions = (
  option: string,
  value: unknown,
  message: string,
): ProcessException =>
  new ProcessException(RUNTIME.INVALID_OPTIONS, {
    details: { option, value },
    message,
  })

const processError = (
  code: RUNTIME,
  options: NormalizedOptions,
  reason: string,
  extra: Pick<ProcessExceptionOptions, 'cause' | 'result'> = {},
): ProcessException =>
  new ProcessException(code, {
    ...safeExceptionData(options, extra),
    details: options.sensitive
      ? { label: options.label }
      : {
          args: options.args,
          cwd: options.cwd,
          executable: options.executable,
          label: options.label,
        },
    message: `Process "${options.label}" ${reason}.`,
  })

const safeExceptionData = (
  options: NormalizedOptions,
  extra: Pick<ProcessExceptionOptions, 'cause' | 'result'>,
): Pick<ProcessExceptionOptions, 'cause' | 'result'> => {
  if (!options.sensitive) return extra
  if (!extra.result) return {}
  return {
    result: {
      durationMs: extra.result.durationMs,
      exitCode: extra.result.exitCode,
      signal: extra.result.signal,
    },
  }
}

const processState = (instance: FuncProcess): ProcessBinding => {
  const state = processStates.get(instance)
  if (state) return state
  throw new ProcessException(RUNTIME.NOT_REGISTERED, {
    message: 'FuncProcess must be registered through ProcessModule before use.',
  })
}
