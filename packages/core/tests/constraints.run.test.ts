import { vi } from 'vitest'
import {
  ArrayValue,
  CatchAll,
  CommandMajor,
  DependsOn,
  Enum,
  Exclusive,
  Exception,
  F_RUNTIME_PRINT,
  Flag,
  FuncException,
  Handler,
  Value,
} from '../src'
import { expect, test } from './_test'

test.sequential('should validate enum constraints', async ({ runContainer }) => {
  expect.assertions(2)
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})

  @CommandMajor()
  class Major {
    @Enum(['dev', 'prod'])
    @Value()
    mode: string = 'dev'

    @Handler()
    run() {}
  }

  @CatchAll()
  class ErrorHandler {
    constructor(@Exception() arg: FuncException) {
      expect(arg.code).toBe(F_RUNTIME_PRINT.VALIDATION)
      arg.preventDefaultPrint()
    }
  }

  await runContainer(['', '', '--mode', 'test'], [Major, ErrorHandler])
  expect(log).not.toHaveBeenCalled()
  log.mockRestore()
})

test.sequential('should validate every array enum item', async ({ runContainer }) => {
  expect.assertions(2)
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})

  @CommandMajor()
  class Major {
    @ArrayValue()
    @Enum(['js', 'ts'])
    ext: string[] = []

    @Handler()
    run() {}
  }

  @CatchAll()
  class ErrorHandler {
    constructor(@Exception() arg: FuncException) {
      expect(arg.code).toBe(F_RUNTIME_PRINT.VALIDATION)
      expect(arg.details.invalid).toEqual(['css'])
      arg.preventDefaultPrint()
    }
  }

  await runContainer(['', '', '--ext', 'js', '--ext', 'css'], [Major, ErrorHandler])
  log.mockRestore()
})

test.sequential('should validate dependsOn and exclusive by explicit input', async ({
  runContainer,
}) => {
  expect.assertions(3)
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})

  @CommandMajor()
  class Major {
    @DependsOn(['token'])
    @Value()
    registry?: string

    @Value()
    token?: string

    @Exclusive(['json'])
    @Flag()
    table = false

    @Flag()
    json = false

    @Handler()
    run() {}
  }

  @CatchAll()
  class ErrorHandler {
    constructor(@Exception() arg: FuncException) {
      expect(arg.code).toBe(F_RUNTIME_PRINT.VALIDATION)
      arg.preventDefaultPrint()
    }
  }

  await runContainer(['', '', '--registry', 'npm'], [Major, ErrorHandler])
  await runContainer(['', '', '--table', '--json'], [Major, ErrorHandler])
  expect(log).not.toHaveBeenCalled()
  log.mockRestore()
})
