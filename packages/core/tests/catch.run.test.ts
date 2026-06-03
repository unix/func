import { vi } from 'vitest'
import {
  Catch,
  CatchAll,
  CommandMajor,
  Enum,
  Exception,
  FuncException,
  Handler,
  Value,
} from '../src'
import { expect, test } from './_test'

test.sequential('should catch command exceptions before catch all', async ({ runContainer }) => {
  expect.assertions(3)
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  let localCaught = false
  let globalCaught = false

  @CommandMajor()
  class Major {
    @Enum(['dev'])
    @Value()
    mode: string = 'dev'

    @Catch()
    onError(@Exception() exception: FuncException) {
      localCaught = true
      expect(exception.message).toContain('must be one of')
    }

    @Handler()
    run() {}
  }

  @CatchAll()
  class ErrorHandler {
    constructor(@Exception() arg: FuncException) {
      globalCaught = true
      arg.preventDefaultPrint()
    }
  }

  await runContainer(['', '', '--mode', 'prod'], [Major, ErrorHandler])

  expect(localCaught).toBe(true)
  expect(globalCaught).toBe(false)
  log.mockRestore()
})

test.sequential('should forward uncaught exceptions to catch all', async ({ runContainer }) => {
  expect.assertions(1)

  @CommandMajor()
  class Major {
    @Handler()
    run() {
      throw new Error('boom')
    }
  }

  @CatchAll()
  class ErrorHandler {
    constructor(@Exception() arg: FuncException) {
      expect(arg.message).toBe('boom')
    }
  }

  await runContainer(['', ''], [Major, ErrorHandler])
})
