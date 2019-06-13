import test from 'ava'
import * as utils from './_utils'
import { Command, Container } from '../src'

test('should invoke', t => {
  const name = utils.random()
  const arg = utils.random()
  class ShouldInvoker {
    constructor() {
      t.pass()
    }
  }
  Command({ name })(ShouldInvoker)
  process.argv = ['', '', name, arg]
  new Container([ShouldInvoker])
})
