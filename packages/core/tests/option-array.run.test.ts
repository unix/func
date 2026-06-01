import test from 'ava'
import * as utils from './_utils'
import {
  Command,
  CommandArgsProvider,
  CommandError,
  CommandErrorProvider,
  Container,
  Option,
  OptionArgsProvider,
  SubOptions,
} from '../src'

test.serial('should collect repeated string option values', t => {
  const name = utils.random()
  @Option({ name, type: [String] })
  class GetOption {
    constructor(arg: OptionArgsProvider) {
      t.deepEqual(arg.value, ['one', 'two'])
      t.deepEqual(arg.native[`--${name}`], ['one', 'two'])
    }
  }
  process.argv = ['', '', `--${name}`, 'one', `--${name}`, 'two']
  new Container([GetOption])
})

test.serial('should collect repeated string sub-option values', t => {
  const name = utils.random()
  const option = utils.random()
  @Command({ name })
  @SubOptions([{ name: option, type: [String] }])
  class GetCommand {
    constructor(arg: CommandArgsProvider) {
      t.deepEqual(arg.option[option], ['one', 'two'])
      t.deepEqual(arg.native[`--${option}`], ['one', 'two'])
    }
  }
  process.argv = ['', '', name, `--${option}`, 'one', `--${option}`, 'two']
  new Container([GetCommand])
})

test.serial('should dispatch an error when option uses Array constructor', t => {
  t.plan(2)
  const name = utils.random()
  @Option({ name, type: Array })
  class GetOption {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      t.is(arg.code, 'FUNC_UNSUPPORTED_ARRAY_TYPE')
      t.true(arg.message.includes('[String]'))
    }
  }

  process.argv = ['', '']
  new Container([GetOption, ErrorHandler])
})

test.serial('should dispatch an error when sub-option uses Array constructor', t => {
  t.plan(2)
  const name = utils.random()
  const option = utils.random()
  @Command({ name })
  @SubOptions([{ name: option, type: Array }])
  class GetCommand {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      t.is(arg.code, 'FUNC_UNSUPPORTED_ARRAY_TYPE')
      t.is(arg.details.option, option)
    }
  }

  process.argv = ['', '']
  new Container([GetCommand, ErrorHandler])
})
