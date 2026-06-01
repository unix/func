import { expect, random, test } from './_test'
import {
  Command,
  CommandError,
  CommandErrorProvider,
  F_RUNTIME_PRINT,
  F_SYSTEM,
  Option,
  OptionArgsProvider,
} from '../src'
import { vi } from 'vitest'

const expectFuncError = (fn: () => void, code: string, details: object) => {
  let thrown

  try {
    fn()
  } catch (error) {
    thrown = error
  }

  expect(thrown).toEqual(
    expect.objectContaining({
      code,
      details: expect.objectContaining(details),
    }),
  )
}

test.sequential('should dispatch multiple global option errors', ({ runContainer }) => {
  expect.assertions(4)
  const help = random()
  const version = random()
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  @Option({ name: help })
  class Help {}
  @Option({ name: version })
  class Version {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      expect(arg.code).toBe(F_RUNTIME_PRINT.MULTIPLE_OPTIONS)
      expect(arg.level).toBe('runtime-print')
      expect(arg.details.options).toEqual([help, version])
      arg.preventDefaultPrint()
    }
  }

  runContainer(['', '', `--${help}`, `--${version}`], [Help, Version, ErrorHandler])
  expect(log).not.toHaveBeenCalled()
  log.mockRestore()
})

test.sequential('should throw duplicate command system errors', ({ runContainer }) => {
  const name = random()
  @Command({ name })
  class FirstCommand {}
  @Command({ name })
  class SecondCommand {}

  expectFuncError(
    () => runContainer(['', ''], [FirstCommand, SecondCommand]),
    F_SYSTEM.DUPLICATE_HANDLER,
    { token: name },
  )
})

test.sequential('should throw duplicate option alias system errors', ({ runContainer }) => {
  @Option({ name: random(), alias: 'd' })
  class FirstOption {}
  @Option({ name: random(), alias: 'd' })
  class SecondOption {}

  expectFuncError(
    () => runContainer(['', ''], [FirstOption, SecondOption]),
    F_SYSTEM.DUPLICATE_HANDLER,
    { token: '-d' },
  )
})

test.sequential('should throw unknown handler system errors', ({ runContainer }) => {
  class UnknownHandler {}

  expectFuncError(
    () => runContainer(['', ''], [UnknownHandler]),
    F_SYSTEM.UNKNOWN_HANDLER,
    { handlers: ['UnknownHandler'] },
  )
})

test.sequential('should dispatch parse errors', ({ runContainer }) => {
  expect.assertions(3)
  const name = random()
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  @Option({ name, type: String })
  class NameOption {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      expect(arg.code).toBe(F_RUNTIME_PRINT.PARSE)
      expect(arg.message).toContain(`--${name}`)
      arg.preventDefaultPrint()
    }
  }

  runContainer(['', '', `--${name}`], [NameOption, ErrorHandler])
  expect(log).not.toHaveBeenCalled()
  log.mockRestore()
})

test.sequential('should dispatch unknown option errors', ({ runContainer }) => {
  expect.assertions(3)
  const name = random()
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  @Command({ name })
  class BuildCommand {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      expect(arg.code).toBe(F_RUNTIME_PRINT.UNKNOWN_OPTION)
      expect(arg.details.options).toEqual(['--wat'])
      arg.preventDefaultPrint()
    }
  }

  runContainer(['', '', name, '--wat'], [BuildCommand, ErrorHandler])
  expect(log).not.toHaveBeenCalled()
  log.mockRestore()
})

test.sequential('should print runtime-print errors by default', ({ runContainer }) => {
  const name = random()
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  @Option({ name, type: String })
  class NameOption {}

  runContainer(['', '', `--${name}`], [NameOption])

  expect(log).toHaveBeenCalledWith(expect.stringContaining(`--${name}`))
  log.mockRestore()
})

test.sequential('should throw missing provider system errors', ({ runContainer }) => {
  const name = random()
  class ConfigProvider {}
  @Command({ name })
  class BuildCommand {
    constructor(_arg: ConfigProvider) {}
  }

  expectFuncError(
    () => runContainer(['', '', name], [BuildCommand]),
    F_SYSTEM.MISSING_PROVIDER,
    { provider: 'ConfigProvider', target: 'BuildCommand' },
  )
})

test.sequential('should throw missing param metadata system errors', ({ runContainer }) => {
  const name = random()
  class NameOption {
    constructor(arg: OptionArgsProvider) {
      throw new Error(String(arg))
    }
  }
  Option({ name })(NameOption)

  expectFuncError(
    () => runContainer(['', '', `--${name}`], [NameOption]),
    F_SYSTEM.MISSING_PARAM_TYPES,
    { target: 'NameOption' },
  )
})
