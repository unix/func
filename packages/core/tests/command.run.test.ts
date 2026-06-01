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

test('should invoke by alias', t => {
  const alias = utils.random()
  const arg = utils.random()
  class ShouldInvoker {
    constructor() {
      t.pass()
    }
  }
  Command({ name: utils.random(), alias })(ShouldInvoker)
  process.argv = ['', '', alias, arg]
  new Container([ShouldInvoker])
})
