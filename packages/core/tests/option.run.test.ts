import test from 'ava'
import * as utils from './_utils'
import { Container, Option, Command } from '../src'

test('should be invoke', t => {
  const arg = utils.random()
  class GetOption {
    constructor() {
      t.pass()
    }
  }
  Option({ name: arg })(GetOption)
  process.argv = ['', '', utils.random(), `--${arg}`]
  new Container([GetOption])
})

test('command should be invoke only', t => {
  const name = utils.random()
  const arg = utils.random()
  class Comand1 {
    constructor() {
      t.pass()
    }
  }
  class Option1 {
    constructor() {
      t.fail()
    }
  }
  Command({ name })(Comand1)
  Option({ name: arg })(Option1)
  process.argv = ['', '', name, `--${arg}`]
  new Container([Comand1, Option1])
})
