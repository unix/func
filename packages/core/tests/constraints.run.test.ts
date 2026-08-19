import {
  ArrayNumber,
  ArrayString,
  CommandMajor,
  DependsOn,
  Enum,
  Exclusive,
  Flag,
  Handler,
  Value,
} from '../src'
import type { Exception, OnError } from '../src'
import { RUNTIME, expect, runtimeErrorCode, test } from './_test'

test.sequential('should validate enum constraints', async ({ runContainer }) => {
  expect.assertions(1)

  @CommandMajor()
  class Major implements OnError {
    @Enum(['dev', 'prod'])
    @Value()
    mode: string = 'dev'

    @Handler()
    run() {}

    onError(error: Exception) {
      expect(error.code).toBe(runtimeErrorCode(RUNTIME.VALIDATION))
    }
  }

  await runContainer(['', '', '--mode', 'test'], [Major])
})

test.sequential(
  'should validate every array enum item',
  async ({ runContainer }) => {
    expect.assertions(2)

    @CommandMajor()
    class Major implements OnError {
      @ArrayString()
      @Enum(['js', 'ts'])
      ext: string[] = []

      @Handler()
      run() {}

      onError(error: Exception) {
        expect(error.code).toBe(runtimeErrorCode(RUNTIME.VALIDATION))
        expect(error.details.invalid).toEqual(['css'])
      }
    }

    await runContainer(['', '', '--ext', 'js', '--ext', 'css'], [Major])
  },
)

test.sequential(
  'should validate every number array enum item',
  async ({ runContainer }) => {
    expect.assertions(2)

    @CommandMajor()
    class Major implements OnError {
      @ArrayNumber()
      @Enum([1, 2])
      level: number[] = []

      @Handler()
      run() {}

      onError(error: Exception) {
        expect(error.code).toBe(runtimeErrorCode(RUNTIME.VALIDATION))
        expect(error.details.invalid).toEqual([3])
      }
    }

    await runContainer(['', '', '--level', '1', '--level', '3'], [Major])
  },
)

test.sequential(
  'should validate dependsOn and exclusive by explicit input',
  async ({ runContainer }) => {
    expect.assertions(2)

    @CommandMajor()
    class Major implements OnError {
      @DependsOn(['token'])
      @Value()
      registry?: string

      @Value()
      token?: string

      @Exclusive(['json'])
      @Flag()
      table = false

      @Flag()
      json = false

      @Handler()
      run() {}

      onError(error: Exception) {
        expect(error.code).toBe(runtimeErrorCode(RUNTIME.VALIDATION))
      }
    }

    await runContainer(['', '', '--registry', 'npm'], [Major])
    await runContainer(['', '', '--table', '--json'], [Major])
  },
)
