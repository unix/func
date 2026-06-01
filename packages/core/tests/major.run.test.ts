import test from 'ava'
import { Container, CommandMajor } from '../src'

test('should invoke major handler', t => {
  class Major {
    constructor() {
      t.pass()
    }
  }
  CommandMajor()(Major)
  process.argv = ['', '']
  new Container([Major])
})
