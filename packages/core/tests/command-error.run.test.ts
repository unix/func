import test from 'ava'
import * as utils from './_utils'
import {
  Command,
  CommandError,
  CommandErrorProvider,
  Container,
  Option,
  OptionArgsProvider,
} from '../src'

test.serial('should dispatch multiple global option errors', t => {
  t.plan(2)
  const help = utils.random()
  const version = utils.random()
  @Option({ name: help })
  class Help {}
  @Option({ name: version })
  class Version {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      t.is(arg.code, 'FUNC_MULTIPLE_OPTIONS')
      t.deepEqual(arg.details.options, [help, version])
    }
  }

  process.argv = ['', '', `--${help}`, `--${version}`]
  new Container([Help, Version, ErrorHandler])
})

test.serial('should dispatch duplicate command errors', t => {
  t.plan(2)
  const name = utils.random()
  @Command({ name })
  class FirstCommand {}
  @Command({ name })
  class SecondCommand {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      t.is(arg.code, 'FUNC_DUPLICATE_HANDLER')
      t.is(arg.details.token, name)
    }
  }

  process.argv = ['', '']
  new Container([FirstCommand, SecondCommand, ErrorHandler])
})

test.serial('should dispatch duplicate option alias errors', t => {
  t.plan(2)
  @Option({ name: utils.random(), alias: 'd' })
  class FirstOption {}
  @Option({ name: utils.random(), alias: 'd' })
  class SecondOption {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      t.is(arg.code, 'FUNC_DUPLICATE_HANDLER')
      t.is(arg.details.token, '-d')
    }
  }

  process.argv = ['', '']
  new Container([FirstOption, SecondOption, ErrorHandler])
})

test.serial('should dispatch unknown handler errors', t => {
  t.plan(2)
  class UnknownHandler {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      t.is(arg.code, 'FUNC_UNKNOWN_HANDLER')
      t.deepEqual(arg.details.handlers, ['UnknownHandler'])
    }
  }

  process.argv = ['', '']
  new Container([UnknownHandler, ErrorHandler])
})

test.serial('should dispatch parse errors', t => {
  t.plan(2)
  const name = utils.random()
  @Option({ name, type: String })
  class NameOption {}

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      t.is(arg.code, 'FUNC_PARSE_ERROR')
      t.true(arg.message.includes(`--${name}`))
    }
  }

  process.argv = ['', '', `--${name}`]
  new Container([NameOption, ErrorHandler])
})

test.serial('should dispatch missing param metadata errors', t => {
  t.plan(2)
  const name = utils.random()
  class NameOption {
    constructor(arg: OptionArgsProvider) {
      t.fail(String(arg))
    }
  }
  Option({ name })(NameOption)

  @CommandError()
  class ErrorHandler {
    constructor(arg: CommandErrorProvider) {
      t.is(arg.code, 'FUNC_MISSING_PARAM_TYPES')
      t.is(arg.details.target, 'NameOption')
    }
  }

  process.argv = ['', '', `--${name}`]
  new Container([NameOption, ErrorHandler])
})
