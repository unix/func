import { vi } from 'vitest'
import {
  Args,
  ArrayValue,
  Command,
  CommandError,
  CommandMajor,
  Container,
  F_RUNTIME_PRINT,
  F_SYSTEM,
  Flag,
  FuncArgs,
  FuncException,
  Handler,
  Exception,
  Required,
  SubOptions,
  Value,
  ValueValidate,
} from '../src'
import { expect, random, test } from './_test'

test.sequential('should run default handler for a command', async ({ runContainer }) => {
  let invoked = false
  const name = random()
  @Command({ name })
  class BuildCommand {
    @Handler()
    run() {
      invoked = true
    }
  }

  await runContainer(['', '', name], [BuildCommand])

  expect(invoked).toBe(true)
})

test.sequential('should run major handler with inferred values and defaults', async ({
  runContainer,
}) => {
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
    run(@Args() arg: FuncArgs) {
      expect(this.verbose).toBe(true)
      expect(this.config).toBe('func.config.ts')
      expect(this.port).toBe(4000)
      expect(arg.option.port).toBe(4000)
    }
  }

  await runContainer(['', '', '--verbose', '--port', '4000'], [Major])
})

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

test.sequential('should reject multiple selected handlers', async ({ runContainer }) => {
  expect.assertions(2)
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  @CommandMajor()
  class Major {
    @Handler({ flag: 'help', alias: 'h' })
    help() {}

    @Handler({ flag: 'version', alias: 'v' })
    version() {}
  }

  @CommandError()
  class ErrorHandler {
    constructor(@Exception() arg: FuncException) {
      expect(arg.code).toBe(F_RUNTIME_PRINT.MULTIPLE_OPTIONS)
      arg.preventDefaultPrint()
    }
  }

  await runContainer(['', '', '-h', '-v'], [Major, ErrorHandler])
  expect(log).not.toHaveBeenCalled()
  log.mockRestore()
})

test.sequential('should support required and validate for values', async ({ runContainer }) => {
  expect.assertions(2)
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  @CommandMajor()
  class Major {
    @Required()
    @Value()
    @ValueValidate(value => Number(value) > 0 || 'port must be positive')
    port?: number

    @Handler()
    run() {}
  }

  @CommandError()
  class ErrorHandler {
    constructor(@Exception() arg: FuncException) {
      expect(arg.code).toBe(F_RUNTIME_PRINT.VALIDATION)
      arg.preventDefaultPrint()
    }
  }

  await runContainer(['', '', '--port', '-1'], [Major, ErrorHandler])
  expect(log).not.toHaveBeenCalled()
  log.mockRestore()
})

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

test.sequential('should keep sub-options as manual parse schema', async ({ runContainer }) => {
  expect.assertions(1)
  @CommandMajor()
  @SubOptions([{ name: 'dry', alias: 'd' }])
  class Major {
    @Handler()
    run(@Args() arg: FuncArgs) {
      expect(arg.option.dry).toBe(true)
    }
  }

  await runContainer(['', '', '-d'], [Major])
})

test.sequential('should throw duplicate errors across sub-options and values', async () => {
  @CommandMajor()
  @SubOptions([{ name: 'config' }])
  class Major {
    @Value()
    config: string = 'func.config.ts'

    @Handler()
    run() {}
  }

  expect(() => new Container([Major])).toThrow(
    expect.objectContaining({ code: F_SYSTEM.DUPLICATE_HANDLER }),
  )
})

test.sequential('should throw when a command has no handler', () => {
  const name = random()
  @Command({ name })
  class BuildCommand {
    @Value()
    config: string = 'func.config.ts'
  }

  expect(() => new Container([BuildCommand])).toThrow(
    expect.objectContaining({ code: F_SYSTEM.MISSING_HANDLER }),
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

  expect(() => new Container([FirstMajor, SecondMajor])).toThrow(
    expect.objectContaining({ code: F_SYSTEM.DUPLICATE_HANDLER }),
  )
})
