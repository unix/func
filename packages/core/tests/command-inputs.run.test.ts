import { expect, random, test } from './_test'
import { Command, CommandArgsProvider } from '../src'

test.sequential('should strip command token from command inputs', ({ runContainer }) => {
  expect.assertions(2)
  const name = random()
  @Command({ name })
  class GetCommand {
    constructor(arg: CommandArgsProvider) {
      expect(arg.inputs).toEqual(['one', 'two'])
      expect(arg.native._).toEqual([name, 'one', 'two'])
    }
  }

  runContainer(['', '', name, 'one', 'two'], [GetCommand])
})
