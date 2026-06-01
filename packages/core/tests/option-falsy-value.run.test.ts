import test from 'ava'
import * as utils from './_utils'
import { Container, Option, OptionArgsProvider } from '../src'

test.serial('should invoke option when number value is zero', t => {
  const name = utils.random()
  @Option({ name, type: Number })
  class GetOption {
    constructor(arg: OptionArgsProvider) {
      t.is(arg.value, 0)
      t.is(arg.native[`--${name}`], 0)
    }
  }
  process.argv = ['', '', `--${name}`, '0']
  new Container([GetOption])
})

test.serial('should invoke option when string value is empty', t => {
  const name = utils.random()
  @Option({ name, type: String })
  class GetOption {
    constructor(arg: OptionArgsProvider) {
      t.is(arg.value, '')
      t.is(arg.native[`--${name}`], '')
    }
  }
  process.argv = ['', '', `--${name}`, '']
  new Container([GetOption])
})

test.serial('should invoke option by alias when number value is zero', t => {
  const name = utils.random()
  const alias = 'z'
  @Option({ name, alias, type: Number })
  class GetOption {
    constructor(arg: OptionArgsProvider) {
      t.is(arg.value, 0)
      t.is(arg.native[`--${name}`], 0)
    }
  }
  process.argv = ['', '', `-${alias}`, '0']
  new Container([GetOption])
})
