import { expect, random, test } from './_test'
import {
  Command,
  CommandArgsProvider,
  F_SYSTEM,
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

test.sequential('should throw a system error when option uses Array constructor', ({
  runContainer,
}) => {
  const name = random()
  @Option({ name, type: Array })
  class GetOption {}

  let thrown
  try {
    runContainer(['', ''], [GetOption])
  } catch (error) {
    thrown = error
  }

  expect(thrown).toEqual(
    expect.objectContaining({
      code: F_SYSTEM.UNSUPPORTED_ARRAY_TYPE,
      message: expect.stringContaining('[String]'),
    }),
  )
})

test.sequential('should throw a system error when sub-option uses Array constructor', ({
  runContainer,
}) => {
  const name = random()
  const option = random()
  @Command({ name })
  @SubOptions([{ name: option, type: Array }])
  class GetCommand {}

  let thrown
  try {
    runContainer(['', ''], [GetCommand])
  } catch (error) {
    thrown = error
  }

  expect(thrown).toEqual(
    expect.objectContaining({
      code: F_SYSTEM.UNSUPPORTED_ARRAY_TYPE,
      details: expect.objectContaining({ option }),
    }),
  )
})
