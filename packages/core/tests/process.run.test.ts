import { CommandMajor, Context, ErrorScope, Handler, Module } from '../src'
import { formatExceptionCode } from '../src/shared/errors'
import {
  FuncProcess,
  PROCESS_RUNTIME,
  ProcessException,
  ProcessModule,
} from '../src/subpath/process'
import { bindFuncProcess } from '../src/subpath/process/runtime'
import { createProcessMock } from '../src/subpath/process/testing'
import { createTestingApp } from '../src/subpath/testing'
import { anyValue, expect, random, test } from './_test'

interface CaptureInvocationResult {
  inherited: { stderr: string; stdout: string }
  replaced: { stdout: string }
}

test.sequential(
  'should inject FuncProcess and capture with invocation context defaults',
  async () => {
    const script = [
      "let input = ''",
      "process.stdin.setEncoding('utf8')",
      "process.stdin.on('data', chunk => input += chunk)",
      "process.stdin.on('end', () => {",
      "process.stderr.write('warning')",
      'process.stdout.write(JSON.stringify({',
      'cwd: process.cwd(),',
      'fromContext: process.env.FROM_CONTEXT,',
      'fromOverride: process.env.FROM_OVERRIDE,',
      'input,',
      '}))',
      '})',
    ].join('\n')

    @CommandMajor()
    class Major {
      constructor(private readonly fp: FuncProcess) {}

      @Handler()
      async run() {
        const inherited = await this.fp.capture(process.execPath, ['-e', script], {
          input: 'payload',
        })
        const replaced = await this.fp.capture(process.execPath, ['-e', script], {
          env: { FROM_OVERRIDE: 'override' },
        })
        return { inherited, replaced }
      }
    }

    @Module({ commands: [Major], imports: [ProcessModule] })
    class AppModule {}

    const cwd = process.cwd()
    const invocation = await createTestingApp(AppModule).invoke([], {
      cwd,
      env: { FROM_CONTEXT: 'context' },
    })
    expect(invocation.error).toBeUndefined()
    const result = invocation.result
    if (!isCaptureInvocationResult(result)) {
      throw new TypeError('Expected process capture results.')
    }
    expect(result.inherited.stderr).toBe('warning')
    expect(JSON.parse(result.inherited.stdout)).toEqual({
      cwd,
      fromContext: 'context',
      input: 'payload',
    })
    expect(JSON.parse(result.replaced.stdout)).toEqual({
      cwd,
      fromOverride: 'override',
      input: '',
    })
  },
)

test.sequential('should forward invocation streams', async () => {
  @CommandMajor()
  class Major {
    constructor(private readonly fp: FuncProcess) {}

    @Handler()
    run() {
      return this.fp.forward(process.execPath, [
        '-e',
        "process.stderr.write('warning');process.stdin.pipe(process.stdout)",
      ])
    }
  }

  @Module({ commands: [Major], imports: [ProcessModule] })
  class AppModule {}

  const invocation = await createTestingApp(AppModule).invoke([], {
    stdin: 'forwarded',
  })
  expect(invocation.error).toBeUndefined()
  expect(invocation.stdout).toBe('forwarded')
  expect(invocation.stderr).toBe('warning')
  expect(invocation.result).toEqual({
    durationMs: anyValue(Number),
    exitCode: 0,
  })
})

test.sequential(
  'should enforce exit, abort, timeout, and output policies',
  async () => {
    const fp = boundProcess()
    await expect(
      fp.capture(process.execPath, ['-e', 'process.exit(3)']),
    ).rejects.toMatchObject({
      code: processRuntimeErrorCode(PROCESS_RUNTIME.EXIT),
      result: { exitCode: 3 },
    })
    const abortController = new AbortController()
    const aborted = fp.capture(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1_000)'],
      { signal: abortController.signal },
    )
    abortController.abort()
    await expect(aborted).rejects.toMatchObject({
      code: processRuntimeErrorCode(PROCESS_RUNTIME.ABORTED),
    })
    await expect(
      fp.capture(process.execPath, ['-e', 'setInterval(() => {}, 1_000)'], {
        timeoutMs: 25,
      }),
    ).rejects.toMatchObject({
      code: processRuntimeErrorCode(PROCESS_RUNTIME.TIMEOUT),
    })
    await expect(
      fp.capture(
        process.execPath,
        ['-e', "process.stdout.write('x'.repeat(2_048))"],
        {
          maxOutputBytes: 32,
        },
      ),
    ).rejects.toMatchObject({
      code: processRuntimeErrorCode(PROCESS_RUNTIME.OUTPUT_LIMIT),
      result: { stdout: 'x'.repeat(32) },
    })
    await expect(
      fp.capture(process.execPath, ['-e', 'process.exit(3)'], {
        acceptedExitCodes: [3],
      }),
    ).resolves.toMatchObject({ exitCode: 3 })
  },
)

test.sequential(
  'should classify spawn failures without leaking sensitive input',
  async () => {
    const fp = boundProcess()
    const executable = `func-process-missing-${random()}`
    let error: unknown

    try {
      await fp.capture(executable, ['secret'], {
        cwd: process.cwd(),
        label: 'credential helper',
        sensitive: true,
      })
    } catch (cause) {
      error = cause
    }

    expect(error).toBeInstanceOf(ProcessException)
    expect(error).toMatchObject({
      code: processRuntimeErrorCode(PROCESS_RUNTIME.NOT_FOUND),
      details: { label: 'credential helper' },
    })
    if (!(error instanceof ProcessException)) throw error
    expect(error.details).not.toHaveProperty('args')
    expect(error.details).not.toHaveProperty('cwd')
    expect(error.details).not.toHaveProperty('executable')
    expect(error.cause).toBeUndefined()
  },
)

test('should require ProcessModule registration', () => {
  expect(() => new FuncProcess().capture('command')).toThrow(
    expect.objectContaining({
      code: processRuntimeErrorCode(PROCESS_RUNTIME.NOT_REGISTERED),
    }),
  )
})

test('should report invalid process options with a process error code', async () => {
  const fp = boundProcess()

  await expect(fp.capture('command', [], { timeoutMs: 0 })).rejects.toMatchObject({
    code: processRuntimeErrorCode(PROCESS_RUNTIME.INVALID_OPTIONS),
    details: { option: 'timeoutMs', value: 0 },
  })
})

test.sequential(
  'should override FuncProcess with a strict process mock',
  async () => {
    const processes = createProcessMock()
    processes.expectCapture('git', ['status']).reply({ stdout: 'clean' })
    processes.expectForward('git', ['push']).reply({
      stderr: 'pushed\n',
    })

    @CommandMajor()
    class Major {
      constructor(private readonly fp: FuncProcess) {}

      @Handler()
      async run() {
        const status = await this.fp.capture('git', ['status'], {
          cwd: '/workspace',
        })
        await this.fp.forward('git', ['push'])
        return status.stdout
      }
    }

    @Module({ commands: [Major], imports: [ProcessModule] })
    class AppModule {}

    const invocation = await createTestingApp(AppModule, {
      overrides: [processes.override()],
    }).invoke()
    expect(invocation.error).toBeUndefined()
    expect(invocation.result).toBe('clean')
    expect(invocation.stderr).toBe('pushed\n')
    expect(processes.calls).toHaveLength(2)
    expect(processes.calls[0]).toMatchObject({
      args: ['status'],
      executable: 'git',
      mode: 'capture',
      options: { cwd: '/workspace' },
    })
    expect(() => processes.verify()).not.toThrow()
  },
)

const boundProcess = (): FuncProcess =>
  bindFuncProcess(
    new FuncProcess(),
    new Context(
      [],
      {
        stderr: process.stderr,
        stdin: process.stdin,
        stdout: process.stdout,
      },
      process.cwd(),
      new AbortController().signal,
      { env: {} },
    ),
  )

const processRuntimeErrorCode = (code: PROCESS_RUNTIME) =>
  formatExceptionCode(ErrorScope.RUNTIME, code)

const isCaptureInvocationResult = (
  value: unknown,
): value is CaptureInvocationResult => {
  if (!isRecord(value)) return false
  const { inherited, replaced } = value
  return (
    isRecord(inherited) &&
    typeof inherited.stderr === 'string' &&
    typeof inherited.stdout === 'string' &&
    isRecord(replaced) &&
    typeof replaced.stdout === 'string'
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
