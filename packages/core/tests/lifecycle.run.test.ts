import {
  APP_FILTER,
  Args,
  ArrayString,
  Catch,
  Command,
  CommandMajor,
  Flag,
  Module,
  Handler,
  Required,
  Value,
  ValueValidate,
  UseFilters,
  createApp,
  createValueDecorator,
} from '../src'
import type { Args as ArgsValue, Exception, ExceptionFilter } from '../src'
import {
  RUNTIME,
  SYSTEM,
  expect,
  random,
  run,
  runtimeErrorCode,
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

  @Catch()
  class AppFilter implements ExceptionFilter {
    catch(error: Exception) {
      expect(error.code).toBe(runtimeErrorCode(RUNTIME.MULTIPLE_OPTIONS))
    }
  }

  @CommandMajor()
  class Major {
    @Handler({ flag: 'help', alias: 'h' })
    help() {}

    @Handler({ flag: 'version', alias: 'v' })
    version() {}
  }

  @Module({
    commands: [Major],
    providers: [{ provide: APP_FILTER, useClass: AppFilter }],
  })
  class AppModule {}

  await run(AppModule, { argv: ['-h', '-v'] })
})

test.sequential(
  'should support required and validate for values',
  async ({ runContainer }) => {
    expect.assertions(1)

    @Catch()
    class ValidationFilter implements ExceptionFilter {
      catch(error: Exception) {
        expect(error.code).toBe(runtimeErrorCode(RUNTIME.VALIDATION))
      }
    }

    @UseFilters(ValidationFilter)
    @CommandMajor()
    class Major {
      @Required()
      @Value()
      @ValueValidate(value => Number(value) > 0 || 'port must be positive')
      port?: number

      @Handler()
      run() {}
    }

    await runContainer(['', '', '--port', '-1'], [Major])
  },
)

test.sequential(
  'should transform string input before field validation and binding',
  async ({ runContainer }) => {
    expect.assertions(5)
    const Url = createValueDecorator(input => {
      expect(input).toBe('https://example.com/releases')
      return new URL(input)
    })

    @CommandMajor()
    class Major {
      @ValueValidate(value => {
        expect(value).toBeInstanceOf(URL)
        return true
      })
      @Url({ alias: 'u', name: 'endpoint' })
      url!: URL

      @Handler()
      run(@Args() args: ArgsValue<{ endpoint: URL }>) {
        expect(this.url).toBeInstanceOf(URL)
        expect(this.url.href).toBe('https://example.com/releases')
        expect(args.options.endpoint).toBe(this.url)
      }
    }

    await runContainer(
      ['', '', '--endpoint', 'https://example.com/releases'],
      [Major],
    )
  },
)

test.sequential(
  'should preserve transformed field defaults without running the transform',
  async ({ runContainer }) => {
    expect.assertions(2)
    let transforms = 0
    const Url = createValueDecorator(input => {
      transforms += 1
      return new URL(input)
    })

    @CommandMajor()
    class Major {
      @Url()
      endpoint = new URL('https://default.example.com')

      @Handler()
      run() {
        expect(this.endpoint.href).toBe('https://default.example.com/')
      }
    }

    await runContainer(['', ''], [Major])
    expect(transforms).toBe(0)
  },
)

test.sequential(
  'should normalize value transform failures as validation errors',
  async ({ runContainer }) => {
    expect.assertions(5)
    let invoked = false
    const Url = createValueDecorator(input => {
      if (!URL.canParse(input)) throw new Error('endpoint must be a valid URL')
      return new URL(input)
    })

    @Catch()
    class ValidationFilter implements ExceptionFilter {
      catch(error: Exception) {
        expect(error.code).toBe(runtimeErrorCode(RUNTIME.VALIDATION))
        expect(error.message).toBe('endpoint must be a valid URL')
        expect(error.details).toMatchObject({
          option: 'endpoint',
          value: 'not-a-url',
        })
        expect(error.cause).toBeInstanceOf(Error)
      }
    }

    @UseFilters(ValidationFilter)
    @CommandMajor()
    class Major {
      @Url()
      endpoint!: URL

      @Handler()
      run() {
        invoked = true
      }
    }

    await runContainer(['', '', '--endpoint', 'not-a-url'], [Major])
    expect(invoked).toBe(false)
  },
)

test.sequential(
  'should reject asynchronous value transforms',
  async ({ runContainer }) => {
    expect.assertions(2)
    const AsyncValue = createValueDecorator(async input => input)

    @Catch()
    class ValidationFilter implements ExceptionFilter {
      catch(error: Exception) {
        expect(error.code).toBe(runtimeErrorCode(RUNTIME.VALIDATION))
        expect(error.message).toBe(
          'Value transform for option "--value" must return synchronously.',
        )
      }
    }

    @UseFilters(ValidationFilter)
    @CommandMajor()
    class Major {
      @AsyncValue()
      value!: string

      @Handler()
      run() {}
    }

    await runContainer(['', '', '--value', 'input'], [Major])
  },
)

test.sequential('should collect array values', async ({ runContainer }) => {
  expect.assertions(1)
  @CommandMajor()
  class Major {
    @ArrayString()
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
    run(testModule({ commands: [Major] }), { argv: [] }),
  ).rejects.toMatchObject({
    code: systemErrorCode(SYSTEM.NO_MATCHING_HANDLER),
  })
})
