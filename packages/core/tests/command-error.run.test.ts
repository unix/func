import { expect, random, test } from './_test'
import {
  Command,
  CommandError,
  CommandErrorProvider,
  Option,
  OptionArgsProvider,
} from '../src'

test.sequential('should dispatch multiple global option errors', ({ runContainer }) => {
  expect.assertions(2)
  const help = random()
  const version = random()
  @Option({ name: help })
  class Help {}
  @Option({ name: version })
  class Version {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      expect(arg.code).toBe('FUNC_MULTIPLE_OPTIONS')
      expect(arg.details.options).toEqual([help, version])
    }
  }

  runContainer(['', '', `--${help}`, `--${version}`], [Help, Version, ErrorHandler])
})

test.sequential('should dispatch duplicate command errors', ({ runContainer }) => {
  expect.assertions(2)
  const name = random()
  @Command({ name })
  class FirstCommand {}
  @Command({ name })
  class SecondCommand {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      expect(arg.code).toBe('FUNC_DUPLICATE_HANDLER')
      expect(arg.details.token).toBe(name)
    }
  }

  runContainer(['', ''], [FirstCommand, SecondCommand, ErrorHandler])
})

test.sequential('should dispatch duplicate option alias errors', ({ runContainer }) => {
  expect.assertions(2)
  @Option({ name: random(), alias: 'd' })
  class FirstOption {}
  @Option({ name: random(), alias: 'd' })
  class SecondOption {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      expect(arg.code).toBe('FUNC_DUPLICATE_HANDLER')
      expect(arg.details.token).toBe('-d')
    }
  }

  runContainer(['', ''], [FirstOption, SecondOption, ErrorHandler])
})

test.sequential('should dispatch unknown handler errors', ({ runContainer }) => {
  expect.assertions(2)
  class UnknownHandler {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      expect(arg.code).toBe('FUNC_UNKNOWN_HANDLER')
      expect(arg.details.handlers).toEqual(['UnknownHandler'])
    }
  }

  runContainer(['', ''], [UnknownHandler, ErrorHandler])
})

test.sequential('should dispatch parse errors', ({ runContainer }) => {
  expect.assertions(2)
  const name = random()
  @Option({ name, type: String })
  class NameOption {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      expect(arg.code).toBe('FUNC_PARSE_ERROR')
      expect(arg.message).toContain(`--${name}`)
    }
  }

  runContainer(['', '', `--${name}`], [NameOption, ErrorHandler])
})

test.sequential('should dispatch missing param metadata errors', ({ runContainer }) => {
  expect.assertions(2)
  const name = random()
  class NameOption {
    constructor(arg: OptionArgsProvider) {
      throw new Error(String(arg))
    }
  }
  Option({ name })(NameOption)

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      expect(arg.code).toBe('FUNC_MISSING_PARAM_TYPES')
      expect(arg.details.target).toBe('NameOption')
    }
  }

  runContainer(['', '', `--${name}`], [NameOption, ErrorHandler])
})
