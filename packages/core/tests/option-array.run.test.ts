import { expect, random, test } from './_test'
import {
  Command,
  CommandArgsProvider,
  CommandError,
  CommandErrorProvider,
  Option,
  OptionArgsProvider,
  SubOptions,
} from '../src'

test.sequential('should collect repeated string option values', ({ runContainer }) => {
  expect.assertions(2)
  const name = random()
  @Option({ name, type: [String] })
  class GetOption {
    constructor(arg: OptionArgsProvider) {
      expect(arg.value).toEqual(['one', 'two'])
      expect(arg.native[`--${name}`]).toEqual(['one', 'two'])
    }
  }

  runContainer(['', '', `--${name}`, 'one', `--${name}`, 'two'], [GetOption])
})

test.sequential('should collect repeated string sub-option values', ({ runContainer }) => {
  expect.assertions(2)
  const name = random()
  const option = random()
  @Command({ name })
  @SubOptions([{ name: option, type: [String] }])
  class GetCommand {
    constructor(arg: CommandArgsProvider) {
      expect(arg.option[option]).toEqual(['one', 'two'])
      expect(arg.native[`--${option}`]).toEqual(['one', 'two'])
    }
  }

  runContainer(['', '', name, `--${option}`, 'one', `--${option}`, 'two'], [GetCommand])
})

test.sequential('should dispatch an error when option uses Array constructor', ({ runContainer }) => {
  expect.assertions(2)
  const name = random()
  @Option({ name, type: Array })
  class GetOption {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      expect(arg.code).toBe('FUNC_UNSUPPORTED_ARRAY_TYPE')
      expect(arg.message).toContain('[String]')
    }
  }

  runContainer(['', ''], [GetOption, ErrorHandler])
})

test.sequential('should dispatch an error when sub-option uses Array constructor', ({ runContainer }) => {
  expect.assertions(2)
  const name = random()
  const option = random()
  @Command({ name })
  @SubOptions([{ name: option, type: Array }])
  class GetCommand {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      expect(arg.code).toBe('FUNC_UNSUPPORTED_ARRAY_TYPE')
      expect(arg.details.option).toBe(option)
    }
  }

  runContainer(['', ''], [GetCommand, ErrorHandler])
})
