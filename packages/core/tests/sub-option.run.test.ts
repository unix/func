import { expect, random, test } from './_test'
import { Command, SubOptions } from '../src'

test.sequential('should be invoke', ({ runContainer }) => {
  let invoked = false
  const name = random()
  const arg = random()
  class Comand1 {
    constructor() {
      invoked = true
    }
  }
  Command({ name })(Comand1)
  SubOptions([{ name: arg }])(Comand1)

  runContainer(['', '', name, `--${arg}`], [Comand1])

  expect(invoked).toBe(true)
})
