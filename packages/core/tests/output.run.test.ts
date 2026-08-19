import {
  CommandMajor,
  Context,
  Ctx,
  Module,
  Handler,
  Injectable,
  Required,
  Stderr,
  Stdin,
  Stdout,
  Value,
  createApp,
} from '../src'
import type { OnError } from '../src'
import { Readable, Writable } from 'node:stream'
import { createTestingApp } from '../src/subpath/testing'
import { SYSTEM, expect, run, systemErrorCode, test, testModule } from './_test'

const captureOutput = () => {
  const chunks: Buffer[] = []
  const stream = new Writable({
    write(
      chunk: string | Uint8Array,
      _encoding: BufferEncoding,
      callback: (error?: Error | null) => void,
    ) {
      chunks.push(Buffer.from(chunk))
      callback()
    },
  })

  return {
    stream,
    text: () => Buffer.concat(chunks).toString('utf8'),
  }
}

const createContext = () =>
  new Context(
    [],
    {
      stderr: process.stderr,
      stdin: process.stdin,
      stdout: process.stdout,
    },
    process.cwd(),
    new AbortController().signal,
  )

test.sequential(
  'should inject configured IO streams across module boundaries',
  async () => {
    expect.assertions(13)
    const input = Readable.from(['input'])
    const output = captureOutput()
    const errorOutput = captureOutput()
    const signal = new AbortController().signal

    @Injectable()
    class Printer {
      constructor(
        @Stdin() readonly stdin: Readable,
        @Stdout() private stdout: Writable,
        @Stderr() private stderr: Writable,
      ) {}

      print() {
        this.stdout.write('\u001b[32mcompleted\u001b[0m\n')
        this.stderr.write('warning\n')
      }
    }

    @Module({ providers: [Printer], exports: [Printer] })
    class OutputModule {}

    @CommandMajor()
    class Major {
      constructor(private printer: Printer) {}

      @Handler()
      run(
        @Ctx() context: Context,
        @Stdin() stdin: Readable,
        @Stdout() stdout: Writable,
        @Stderr() stderr: Writable,
      ) {
        expect(context.io.stdin).toBe(input)
        expect(context.io.stdout).toBe(output.stream)
        expect(context.io.stderr).toBe(errorOutput.stream)
        expect(stdin).toBe(context.io.stdin)
        expect(stdout).toBe(context.io.stdout)
        expect(stderr).toBe(context.io.stderr)
        expect(this.printer.stdin).toBe(context.io.stdin)
        expect(context.cwd).toBe('/workspace')
        expect(context.signal).toBe(signal)
        this.printer.print()
      }
    }

    @Module({ commands: [Major], imports: [OutputModule] })
    class AppModule {}

    await run(AppModule, {
      argv: [],
      cwd: '/workspace',
      stderr: errorOutput.stream,
      signal,
      stdin: input,
      stdout: output.stream,
    })
    expect(output.text()).toBe('\u001b[32mcompleted\u001b[0m\n')
    expect(errorOutput.text()).toBe('warning\n')
    expect(output.stream.writableEnded).toBe(false)
    expect(errorOutput.stream.writableEnded).toBe(false)
  },
)

test.sequential('should write framework errors to configured stderr', async () => {
  const output = captureOutput()
  const errorOutput = captureOutput()

  @CommandMajor()
  class Major {
    @Required()
    @Value()
    target?: string

    @Handler()
    run() {}
  }

  await run(testModule({ commands: [Major] }), {
    argv: [],
    stderr: errorOutput.stream,
    stdout: output.stream,
  })
  expect(output.text()).toBe('')
  expect(errorOutput.text()).toBe('Option "--target" is required.\n')
})

test.sequential('should allow error handlers to prevent output', async () => {
  const errorOutput = captureOutput()

  @CommandMajor()
  class Major {
    @Required()
    @Value()
    target?: string

    @Handler()
    run() {}
  }

  @Module({ commands: [Major] })
  class AppModule implements OnError {
    onError() {}
  }

  const result = await run(AppModule, {
    argv: [],
    stderr: errorOutput.stream,
  })
  expect(errorOutput.text()).toBe('')
  expect(result.exitCode).toBe(1)
})

test.sequential(
  'should allow an error handler to recover the exit code',
  async () => {
    @CommandMajor()
    class Major {
      @Handler()
      run() {
        throw new Error('handled')
      }
    }

    @Module({ commands: [Major] })
    class AppModule implements OnError {
      constructor(private readonly context: Context) {}

      onError() {
        this.context.exitCode = 0
      }
    }

    const result = await run(AppModule, { argv: [] })
    expect(result.exitCode).toBe(0)
  },
)

test.sequential('should expose the final exit code from context', async () => {
  @CommandMajor()
  class Major {
    constructor(private context: Context) {}

    @Handler()
    run() {
      this.context.exitCode = 2
    }
  }

  const result = await run(testModule({ commands: [Major] }), {
    argv: [],
  })
  expect(result.exitCode).toBe(2)
})

test.sequential('should reject invalid context exit codes', async () => {
  @CommandMajor()
  class Major {
    constructor(private context: Context) {}

    @Handler()
    run() {
      this.context.exitCode = 256
    }
  }

  const result = await createTestingApp(testModule({ commands: [Major] })).invoke()
  expect(result).toMatchObject({ error: undefined, exitCode: 1 })
  expect(result.stderr).toContain(
    'Context.exitCode must be an integer between 0 and 255.',
  )
})

test.sequential('should inject native process streams by default', async () => {
  expect.assertions(2)

  @CommandMajor()
  class Major {
    @Handler()
    run(@Stdout() stdout: Writable, @Stderr() stderr: Writable) {
      expect(stdout).toBe(process.stdout)
      expect(stderr).toBe(process.stderr)
    }
  }

  await run(testModule({ commands: [Major] }), { argv: [] })
})

test('should reject context as a module provider', () => {
  expect(() =>
    createApp(
      testModule({
        providers: [{ provide: Context, useValue: createContext() }],
      }),
    ),
  ).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_PROVIDER),
      details: { module: 'TestModule', token: 'Context' },
    }),
  )
})

test('should reject context as a testing override', () => {
  expect(() =>
    createTestingApp(testModule({}), {
      overrides: [{ provide: Context, useValue: createContext() }],
    }),
  ).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_PROVIDER),
      details: { token: 'Context' },
    }),
  )
})
