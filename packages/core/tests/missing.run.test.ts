import { expect, random, test } from './_test'
import { CommandMissing } from '../src'

test.sequential('should invoke not found handler', ({ runContainer }) => {
  let invoked = false
  const name = random()
  const arg = random()
  class NotFound {
    constructor() {
      invoked = true
    }
  }
  CommandMissing()(NotFound)

  runContainer(['', '', name, arg], [NotFound])

  expect(invoked).toBe(true)
})
