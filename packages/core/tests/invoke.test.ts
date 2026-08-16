import * as func from '../src'
import { CommandMajor, Handler, Module } from '../src'
import { createInvoker } from '../src/subpath/invoke'
import { expect, test } from './_test'

test('should keep imperative invocation out of the main entry', () => {
  expect('createInvoker' in func).toBe(false)
  expect('Container' in func).toBe(false)
  expect('run' in func).toBe(false)
})

test.sequential(
  'should invoke repeatedly without exposing process bootstrap semantics',
  async () => {
    let calls = 0
    const previousExitCode = process.exitCode

    @CommandMajor()
    class Major {
      @Handler()
      run() {
        calls += 1
        return calls
      }
    }

    @Module({ commands: [Major] })
    class AppModule {}

    const invoker = createInvoker(AppModule)
    try {
      process.exitCode = 9
      expect(invoker).not.toHaveProperty('bootstrap')
      await expect(invoker.invoke([])).resolves.toEqual({
        exitCode: 0,
        result: 1,
      })
      await expect(invoker.invoke([])).resolves.toEqual({
        exitCode: 0,
        result: 2,
      })
      expect(process.exitCode).toBe(9)
    } finally {
      process.exitCode = previousExitCode
    }
  },
)
