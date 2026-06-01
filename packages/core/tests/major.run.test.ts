import { expect, test } from './_test'
import { CommandMajor } from '../src'

test.sequential('should invoke major handler', ({ runContainer }) => {
  let invoked = false
  class Major {
    constructor() {
      invoked = true
    }
  }
  CommandMajor()(Major)

  runContainer(['', ''], [Major])

  expect(invoked).toBe(true)
})
