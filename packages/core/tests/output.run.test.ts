import {
  CommandMajor,
  Context,
  Exception,
  ExceptionContext,
  Module,
  Handler,
  Inject,
  Injectable,
  Required,
  Value,
  createApp,
  run,
} from '../src'
import type { OnError } from '../src'
import { Writable } from 'node:stream'
import { createTestingApp } from '../src/subpath/testing'
import { SYSTEM, expect, systemErrorCode, test, testModule } from './_test'

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

test.sequential(
  'should inject configured output streams across module boundaries',
  async () => {
    expect.assertions(8)
    const output = captureOutput()
    const errorOutput = captureOutput()
    const signal = new AbortController().signal

    @Injectable()
    class Printer {
      constructor(private context: Context) {}

      print() {
        this.context.io.stdout.write('\u001b[32mcompleted\u001b[0m\n')
        this.context.io.stderr.write('warning\n')
      }
    }

    @Module({ providers: [Printer], exports: [Printer] })
    class OutputModule {}

    @CommandMajor()
    class Major {
      constructor(private printer: Printer) {}

      @Handler()
      run(@Inject(Context) context: Context) {
        expect(context.io.stdout).toBe(output.stream)
        expect(context.io.stderr).toBe(errorOutput.stream)
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
    onError(_exception: Exception, context: ExceptionContext) {
      context.preventDefaultPrint()
    }
  }

  const result = await createApp(AppModule, {
    argv: [],
    stderr: errorOutput.stream,
  }).run()
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

      onError(_exception: Exception, exceptionContext: ExceptionContext) {
        this.context.exitCode = 0
        exceptionContext.preventDefaultPrint()
      }
    }

    const result = await createApp(AppModule, { argv: [] }).run()
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

  const result = await createApp(testModule({ commands: [Major] }), {
    argv: [],
  }).run()
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

  await expect(
    createApp(testModule({ commands: [Major] }), { argv: [] }).run(),
  ).rejects.toThrow('Context.exitCode must be an integer between 0 and 255.')
})

test.sequential('should inject process streams by default', async () => {
  expect.assertions(2)

  @CommandMajor()
  class Major {
    constructor(private context: Context) {}

    @Handler()
    run() {
      expect(this.context.io.stdout).toBe(process.stdout)
      expect(this.context.io.stderr).toBe(process.stderr)
    }
  }

  await run(testModule({ commands: [Major] }), { argv: [] })
})

test('should reject context as a module provider', () => {
  expect(() =>
    createApp(
      testModule({
        providers: [{ provide: Context, useValue: {} as Context }],
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
      overrides: [{ provide: Context, useValue: {} as Context }],
    }),
  ).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_PROVIDER),
      details: { token: 'Context' },
    }),
  )
})
