import test from 'ava'
import * as utils from './_utils'
import { Command, CommandMajor, Container, SubOptions } from '../src'

test('should be invoke', t => {
  const name = utils.random()
  const arg = utils.random()
  class Comand1 {
    constructor() {
      t.pass()
    }
  }
  Command({ name })(Comand1)
  SubOptions([{ name: arg }])(Comand1)
  process.argv = ['', '', name, `--${arg}`]
  new Container([Comand1])
})

test('should be invoke with major', t => {
  const arg = utils.random()
  
  class Major {
    constructor() {
      t.pass()
    }
  }
  CommandMajor()(Major)
  SubOptions([{ name: arg }])(Major)
  process.argv = ['', '', `--${arg}`]
  new Container([Major])
})
