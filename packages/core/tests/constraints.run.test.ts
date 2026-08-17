import {
  ArrayNumber,
  ArrayString,
  Catch,
  CommandMajor,
  DependsOn,
  Enum,
  Exclusive,
  Flag,
  Handler,
  UseFilters,
  Value,
} from '../src'
import type { Exception, ExceptionFilter } from '../src'
import { RUNTIME, expect, runtimeErrorCode, test } from './_test'

test.sequential('should validate enum constraints', async ({ runContainer }) => {
  expect.assertions(1)

  @Catch()
  class ValidationFilter implements ExceptionFilter {
    catch(error: Exception) {
      expect(error.code).toBe(runtimeErrorCode(RUNTIME.VALIDATION))
    }
  }

  @UseFilters(ValidationFilter)
  @CommandMajor()
  class Major {
    @Enum(['dev', 'prod'])
    @Value()
    mode: string = 'dev'

    @Handler()
    run() {}
  }

  await runContainer(['', '', '--mode', 'test'], [Major])
})

test.sequential(
  'should validate every array enum item',
  async ({ runContainer }) => {
    expect.assertions(2)

    @Catch()
    class ValidationFilter implements ExceptionFilter {
      catch(error: Exception) {
        expect(error.code).toBe(runtimeErrorCode(RUNTIME.VALIDATION))
        expect(error.details.invalid).toEqual(['css'])
      }
    }

    @UseFilters(ValidationFilter)
    @CommandMajor()
    class Major {
      @ArrayString()
      @Enum(['js', 'ts'])
      ext: string[] = []

      @Handler()
      run() {}
    }

    await runContainer(['', '', '--ext', 'js', '--ext', 'css'], [Major])
  },
)

test.sequential(
  'should validate every number array enum item',
  async ({ runContainer }) => {
    expect.assertions(2)

    @Catch()
    class ValidationFilter implements ExceptionFilter {
      catch(error: Exception) {
        expect(error.code).toBe(runtimeErrorCode(RUNTIME.VALIDATION))
        expect(error.details.invalid).toEqual([3])
      }
    }

    @UseFilters(ValidationFilter)
    @CommandMajor()
    class Major {
      @ArrayNumber()
      @Enum([1, 2])
      level: number[] = []

      @Handler()
      run() {}
    }

    await runContainer(['', '', '--level', '1', '--level', '3'], [Major])
  },
)

test.sequential(
  'should validate dependsOn and exclusive by explicit input',
  async ({ runContainer }) => {
    expect.assertions(2)

    @Catch()
    class ValidationFilter implements ExceptionFilter {
      catch(error: Exception) {
        expect(error.code).toBe(runtimeErrorCode(RUNTIME.VALIDATION))
      }
    }

    @UseFilters(ValidationFilter)
    @CommandMajor()
    class Major {
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
    }

    await runContainer(['', '', '--registry', 'npm'], [Major])
    await runContainer(['', '', '--table', '--json'], [Major])
  },
)
