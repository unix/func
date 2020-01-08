import test from 'ava'
import * as utils from './_utils'
import { Container, CommandMissing } from '../src'

test('should invoke not found handler', t => {
  const name = utils.random()
  const arg = utils.random()
  class NotFound {
    constructor() {
      t.pass()
    }
  }
  CommandMissing()(NotFound)
  process.argv = ['', '', name, arg]
  new Container([NotFound])
})
