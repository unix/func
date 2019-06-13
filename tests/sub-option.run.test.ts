import test from 'ava'
import * as utils from './_utils'
import { Command, Container, SubOptions } from '../src'

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
