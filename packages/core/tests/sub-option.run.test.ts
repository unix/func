import { expect, random, test } from './_test'
import { Command, F_SYSTEM, SubOptions } from '../src'

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

test.sequential('should throw duplicate sub-option system errors', ({ runContainer }) => {
  const name = random()
  const option = random()
  @Command({ name })
  @SubOptions([{ name: option }, { name: option }])
  class Comand1 {}

  let thrown
  try {
    runContainer(['', ''], [Comand1])
  } catch (error) {
    thrown = error
  }

  expect(thrown).toEqual(
    expect.objectContaining({
      code: F_SYSTEM.DUPLICATE_HANDLER,
      details: expect.objectContaining({ token: `--${option}` }),
    }),
  )
})
