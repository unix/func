import { expect, random, test } from './_test'
import { Command, Container } from '../src'

test.sequential('should invoke', ({ runContainer }) => {
  let invoked = false
  const name = random()
  const arg = random()
  class ShouldInvoker {
    constructor() {
      invoked = true
    }
  }
  Command({ name })(ShouldInvoker)

  runContainer(['', '', name, arg], [ShouldInvoker])

  expect(invoked).toBe(true)
})

test.sequential('should invoke by alias', ({ runContainer }) => {
  let invoked = false
  const alias = random()
  const arg = random()
  class ShouldInvoker {
    constructor() {
      invoked = true
    }
  }
  Command({ name: random(), alias })(ShouldInvoker)

  runContainer(['', '', alias, arg], [ShouldInvoker])

  expect(invoked).toBe(true)
})

test.sequential('should accept argv from container options', () => {
  let invoked = false
  const name = random()
  @Command({ name })
  class ShouldInvoker {
    constructor() {
      invoked = true
    }
  }

  new Container([ShouldInvoker], { argv: [name] })

  expect(invoked).toBe(true)
})
