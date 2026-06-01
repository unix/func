import test from 'ava'
import * as utils from './_utils'
import { Command, CommandArgsProvider, Container } from '../src'

test.serial('should strip command token from command inputs', t => {
  const name = utils.random()
  @Command({ name })
  class GetCommand {
    constructor(arg: CommandArgsProvider) {
      t.deepEqual(arg.inputs, ['one', 'two'])
      t.deepEqual(arg.native._, [name, 'one', 'two'])
    }
  }

  process.argv = ['', '', name, 'one', 'two']
  new Container([GetCommand])
})
