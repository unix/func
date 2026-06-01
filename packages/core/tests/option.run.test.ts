import { expect, random, test } from './_test'
import { Option, Command } from '../src'

test.sequential('should be invoke', ({ runContainer }) => {
  let invoked = false
  const arg = random()
  class GetOption {
    constructor() {
      invoked = true
    }
  }
  Option({ name: arg })(GetOption)

  runContainer(['', '', random(), `--${arg}`], [GetOption])

  expect(invoked).toBe(true)
})

test.sequential('registered global option should not affect command invocation', ({
  runContainer,
}) => {
  let invoked = false
  const name = random()
  const arg = random()
  class Comand1 {
    constructor() {
      invoked = true
    }
  }
  class Option1 {
    constructor() {
      throw new Error('option should not be invoked')
    }
  }
  Command({ name })(Comand1)
  Option({ name: arg })(Option1)

  runContainer(['', '', name], [Comand1, Option1])

  expect(invoked).toBe(true)
})
