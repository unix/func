import {
  Args,
  ArrayValue,
  Command,
  CommandMajor,
  Flag,
  Exception,
  ExceptionContext,
  Module,
  Handler,
  Required,
  Value,
  ValueValidate,
  createApp,
  run,
} from '../src'
import type { Args as ArgsValue, OnError } from '../src'
import {
  RUNTIME_PRINT,
  SYSTEM,
  expect,
  random,
  runtimePrintErrorCode,
  systemErrorCode,
  test,
  testModule,
} from './_test'

test.sequential(
  'should run default handler for a command',
  async ({ runContainer }) => {
    let invoked = false
    const name = random()
    @Command(name)
    class BuildCommand {
      @Handler()
      run() {
        invoked = true
      }
    }

    await runContainer(['', '', name], [BuildCommand])
    expect(invoked).toBe(true)
  },
)

test.sequential(
  'should run major handler with inferred values and defaults',
  async ({ runContainer }) => {
    expect.assertions(4)
    @CommandMajor()
    class Major {
      @Flag()
      verbose = false

      @Value()
      config: string = 'func.config.ts'

      @Value()
      port: number = 3000

      @Handler()
      run(@Args() arg: ArgsValue) {
        expect(this.verbose).toBe(true)
        expect(this.config).toBe('func.config.ts')
        expect(this.port).toBe(4000)
        expect(arg.options.port).toBe(4000)
      }
    }

    await runContainer(['', '', '--verbose', '--port', '4000'], [Major])
  },
)

test.sequential('should select a handler by flag', async ({ runContainer }) => {
  let selected = ''
  @CommandMajor()
  class Major {
    @Handler({ flag: 'help', alias: 'h' })
    help() {
      selected = 'help'
    }

    @Handler()
    run() {
      selected = 'run'
    }
  }

  await runContainer(['', '', '-h'], [Major])
  expect(selected).toBe('help')
})

test.sequential('should reject multiple selected handlers', async () => {
  expect.assertions(1)
  @CommandMajor()
  class Major {
    @Handler({ flag: 'help', alias: 'h' })
    help() {}

    @Handler({ flag: 'version', alias: 'v' })
    version() {}
  }

  @Module({ commands: [Major] })
  class AppModule implements OnError {
    onError(arg: Exception, context: ExceptionContext) {
      expect(arg.code).toBe(runtimePrintErrorCode(RUNTIME_PRINT.MULTIPLE_OPTIONS))
      context.preventDefaultPrint()
    }
  }

  await run(AppModule, { argv: ['-h', '-v'] })
})

test.sequential(
  'should support required and validate for values',
  async ({ runContainer }) => {
    expect.assertions(1)
    @CommandMajor()
    class Major implements OnError {
      @Required()
      @Value()
      @ValueValidate(value => Number(value) > 0 || 'port must be positive')
      port?: number

      onError(arg: Exception, context: ExceptionContext) {
        expect(arg.code).toBe(runtimePrintErrorCode(RUNTIME_PRINT.VALIDATION))
        context.preventDefaultPrint()
      }

      @Handler()
      run() {}
    }

    await runContainer(['', '', '--port', '-1'], [Major])
  },
)

test.sequential('should collect array values', async ({ runContainer }) => {
  expect.assertions(1)
  @CommandMajor()
  class Major {
    @ArrayValue()
    include: string[] = []

    @Handler()
    run() {
      expect(this.include).toEqual(['one', 'two'])
    }
  }

  await runContainer(['', '', '--include', 'one', '--include', 'two'], [Major])
})

test.sequential('should throw when a command has no handler', () => {
  const name = random()
  @Command(name)
  class BuildCommand {
    @Value()
    config: string = 'func.config.ts'
  }

  expect(() => createApp(testModule({ commands: [BuildCommand] }))).toThrow(
    expect.objectContaining({ code: systemErrorCode(SYSTEM.MISSING_HANDLER) }),
  )
})

test.sequential('should support async handlers', async ({ runContainer }) => {
  let invoked = false
  @CommandMajor()
  class Major {
    @Handler()
    async run() {
      await Promise.resolve()
      invoked = true
    }
  }

  await runContainer(['', ''], [Major])
  expect(invoked).toBe(true)
})

test.sequential('should allow only one major command', () => {
  @CommandMajor()
  class FirstMajor {
    @Handler()
    run() {}
  }

  @CommandMajor()
  class SecondMajor {
    @Handler()
    run() {}
  }

  expect(() =>
    createApp(testModule({ commands: [FirstMajor, SecondMajor] })),
  ).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.MULTIPLE_MAJOR_COMMANDS),
    }),
  )
})

test.sequential('should throw when no handler matches the invocation', async () => {
  @CommandMajor()
  class Major {
    @Handler({ flag: 'help' })
    help() {}
  }

  await expect(
    createApp(testModule({ commands: [Major] }), { argv: [] }).run(),
  ).rejects.toMatchObject({
    code: systemErrorCode(SYSTEM.NO_MATCHING_HANDLER),
  })
})
