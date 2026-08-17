import { Context } from '../../../runtime/context'
import type { ProviderOverride } from '../../testing/provider-overrides'
import type {
  ProcessCaptureOptions,
  ProcessCaptureResult,
  ProcessForwardOptions,
  ProcessStatus,
} from '../interfaces'
import { FuncProcess } from '../runtime'

export type ProcessMockMode = 'capture' | 'forward'

export interface ProcessMockCall {
  readonly args: readonly string[]
  readonly executable: string
  readonly mode: ProcessMockMode
  readonly options: ProcessCaptureOptions | ProcessForwardOptions
}

export interface ProcessMockReply {
  durationMs?: number
  exitCode?: number
  stderr?: string
  stdout?: string
}

export interface ProcessMockExpectation {
  reject(error: Error): void
  reply(result?: ProcessMockReply): void
}

export interface ProcessMock {
  readonly calls: readonly ProcessMockCall[]
  expectCapture(executable: string, args?: readonly string[]): ProcessMockExpectation
  expectForward(executable: string, args?: readonly string[]): ProcessMockExpectation
  override(): ProviderOverride
  verify(): void
}

interface ExpectedProcess {
  readonly args: readonly string[]
  readonly executable: string
  readonly mode: ProcessMockMode
  outcome?: ProcessMockOutcome
}

type ProcessMockOutcome =
  | { readonly error: Error; readonly type: 'reject' }
  | { readonly result: ProcessMockReply; readonly type: 'reply' }

type AssertProcessMockReply = (reply: unknown) => asserts reply is ProcessMockReply

interface ProcessMockConsumer {
  consume(call: ProcessMockCall): ProcessMockOutcome
}

class MockFuncProcess extends FuncProcess {
  constructor(
    private readonly controller: ProcessMockConsumer,
    private readonly context: Context,
  ) {
    super()
  }

  override async capture(
    executable: string,
    args: readonly string[] = [],
    options: ProcessCaptureOptions = {},
  ): Promise<ProcessCaptureResult> {
    const outcome = this.consume('capture', executable, args, options)
    if (outcome.type === 'reject') throw outcome.error
    return {
      durationMs: outcome.result.durationMs ?? 0,
      exitCode: outcome.result.exitCode ?? 0,
      stderr: outcome.result.stderr ?? '',
      stdout: outcome.result.stdout ?? '',
    }
  }

  override async forward(
    executable: string,
    args: readonly string[] = [],
    options: ProcessForwardOptions = {},
  ): Promise<ProcessStatus> {
    const outcome = this.consume('forward', executable, args, options)
    if (outcome.type === 'reject') throw outcome.error
    await Promise.all([
      writeOutput(this.context.io.stdout, outcome.result.stdout),
      writeOutput(this.context.io.stderr, outcome.result.stderr),
    ])
    return {
      durationMs: outcome.result.durationMs ?? 0,
      exitCode: outcome.result.exitCode ?? 0,
    }
  }

  override async onDispose(): Promise<void> {}

  private consume(
    mode: ProcessMockMode,
    executable: string,
    args: readonly string[],
    options: ProcessCaptureOptions | ProcessForwardOptions,
  ): ProcessMockOutcome {
    return this.controller.consume({
      args: Object.freeze(args.slice()),
      executable,
      mode,
      options: Object.freeze({ ...options }),
    })
  }
}

class ProcessMockController implements ProcessMock {
  private readonly recordedCalls: ProcessMockCall[] = []
  private readonly expectations: ExpectedProcess[] = []

  get calls(): readonly ProcessMockCall[] {
    return Object.freeze(this.recordedCalls.slice())
  }

  expectCapture(
    executable: string,
    args: readonly string[] = [],
  ): ProcessMockExpectation {
    return this.expect('capture', executable, args)
  }

  expectForward(
    executable: string,
    args: readonly string[] = [],
  ): ProcessMockExpectation {
    return this.expect('forward', executable, args)
  }

  override(): ProviderOverride {
    return {
      inject: [Context],
      provide: FuncProcess,
      useFactory: (context: Context) => new MockFuncProcess(this, context),
    }
  }

  verify() {
    if (!this.expectations.length) return
    const next = this.expectations[0]
    throw new Error(
      `Expected ${this.expectations.length} more process invocation(s); next was ${formatCommand(next)}.`,
    )
  }

  consume(call: ProcessMockCall): ProcessMockOutcome {
    this.recordedCalls.push(call)
    const expected = this.expectations.at(0)
    if (!expected) {
      throw new Error(`Unexpected process invocation: ${formatCommand(call)}.`)
    }
    if (!matches(expected, call)) {
      throw new Error(
        `Unexpected process invocation: received ${formatCommand(call)}, expected ${formatCommand(expected)}.`,
      )
    }
    if (!expected.outcome) {
      throw new Error(
        `Process expectation ${formatCommand(expected)} does not have a reply or rejection.`,
      )
    }

    this.expectations.shift()
    return expected.outcome
  }

  private expect(
    mode: ProcessMockMode,
    executable: string,
    args: readonly string[],
  ): ProcessMockExpectation {
    assertCommand(executable, args)
    const expected: ExpectedProcess = {
      args: Object.freeze(args.slice()),
      executable,
      mode,
    }
    this.expectations.push(expected)

    return {
      reject: error => {
        if (!(error instanceof Error)) {
          throw new TypeError('Process mock rejection must be an Error.')
        }
        setOutcome(expected, { error, type: 'reject' })
      },
      reply: (result = {}) => {
        assertReply(result)
        setOutcome(expected, { result: Object.freeze({ ...result }), type: 'reply' })
      },
    }
  }
}

export const createProcessMock = (): ProcessMock => new ProcessMockController()

const matches = (expected: ExpectedProcess, actual: ProcessMockCall): boolean =>
  expected.mode === actual.mode &&
  expected.executable === actual.executable &&
  expected.args.length === actual.args.length &&
  expected.args.every((arg, index) => arg === actual.args[index])

const setOutcome = (expected: ExpectedProcess, outcome: ProcessMockOutcome) => {
  if (expected.outcome) {
    throw new Error(
      `Process expectation ${formatCommand(expected)} already has an outcome.`,
    )
  }
  expected.outcome = outcome
}

const assertCommand = (executable: string, args: readonly string[]) => {
  if (typeof executable !== 'string' || !executable.length) {
    throw new TypeError('Process mock executable must be a non-empty string.')
  }
  if (!Array.isArray(args) || args.some(arg => typeof arg !== 'string')) {
    throw new TypeError('Process mock args must be an array of strings.')
  }
}

const assertReply: AssertProcessMockReply = (
  reply: unknown,
): asserts reply is ProcessMockReply => {
  if (typeof reply !== 'object' || reply === null) {
    throw new TypeError('Process mock reply must be an object.')
  }
  const durationMs: unknown = Reflect.get(reply, 'durationMs')
  const exitCode: unknown = Reflect.get(reply, 'exitCode')
  const stderr: unknown = Reflect.get(reply, 'stderr')
  const stdout: unknown = Reflect.get(reply, 'stdout')
  if (
    durationMs !== undefined &&
    (typeof durationMs !== 'number' ||
      !Number.isSafeInteger(durationMs) ||
      durationMs < 0)
  ) {
    throw new TypeError('Process mock durationMs must be a non-negative integer.')
  }
  if (
    exitCode !== undefined &&
    (typeof exitCode !== 'number' || !Number.isSafeInteger(exitCode) || exitCode < 0)
  ) {
    throw new TypeError('Process mock exitCode must be a non-negative integer.')
  }
  if (stderr !== undefined && typeof stderr !== 'string') {
    throw new TypeError('Process mock stderr must be a string.')
  }
  if (stdout !== undefined && typeof stdout !== 'string') {
    throw new TypeError('Process mock stdout must be a string.')
  }
}

const writeOutput = (
  stream: NodeJS.WritableStream,
  output: string | undefined,
): Promise<void> => {
  if (!output) return Promise.resolve()
  return new Promise((resolve, reject) => {
    stream.write(output, error => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

const formatCommand = (input: {
  readonly args: readonly string[]
  readonly executable: string
  readonly mode: ProcessMockMode
}): string => JSON.stringify([input.mode, input.executable, ...input.args])
