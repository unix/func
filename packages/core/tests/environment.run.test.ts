import { CommandMajor, Context, Handler, Module, createApp } from '../src'
import { createInvoker } from '../src/subpath/invoke'
import { environment } from '../src/shared/environment'
import { createTestingApp } from '../src/subpath/testing'
import { expect, test } from './_test'

@CommandMajor()
class EnvironmentCommand {
  constructor(private readonly context: Context) {}

  @Handler()
  run() {
    return this.context.env
  }
}

@Module({ commands: [EnvironmentCommand] })
class EnvironmentAppModule {}

test('should normalize environment values into a frozen snapshot', () => {
  const input: Record<string, string | undefined> = {
    EMPTY: '',
    FIRST: 'before',
    REMOVED: undefined,
  }
  const normalized = environment.normalize(input)
  input.FIRST = 'after'
  expect(normalized).toEqual({ EMPTY: '', FIRST: 'before' })
  expect(Object.getPrototypeOf(normalized)).toBeNull()
  expect(Object.isFrozen(normalized)).toBe(true)
})

test.sequential(
  'should normalize environment keys using platform casing rules',
  () => {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    if (!descriptor) throw new TypeError('process.platform is not configurable.')

    try {
      Object.defineProperty(process, 'platform', {
        ...descriptor,
        value: 'win32',
      })
      expect(environment.normalize({ Path: '/first', PATH: '/second' })).toEqual({
        PATH: '/second',
      })
      expect(environment.normalize({ Path: '/first', PATH: undefined })).toEqual({})

      Object.defineProperty(process, 'platform', {
        ...descriptor,
        value: 'linux',
      })
      expect(environment.normalize({ Path: '/first', PATH: '/second' })).toEqual({
        PATH: '/second',
        Path: '/first',
      })
    } finally {
      Object.defineProperty(process, 'platform', descriptor)
    }
  },
)

test.sequential(
  'should expose the configured bootstrap environment through context',
  async () => {
    const previousExitCode = process.exitCode
    const input: Record<string, string | undefined> = {
      EMPTY: '',
      VALUE: 'before',
    }
    let context: Context | undefined

    @CommandMajor()
    class Major {
      constructor(current: Context) {
        context = current
      }

      @Handler()
      run() {}
    }

    @Module({ commands: [Major] })
    class AppModule {}

    try {
      const invocation = createApp(AppModule).bootstrap({ argv: [], env: input })
      input.VALUE = 'after'
      await invocation
      expect(context?.env).toEqual({ EMPTY: '', VALUE: 'before' })
      expect(Object.hasOwn(context ?? {}, 'env')).toBe(false)
    } finally {
      process.exitCode = previousExitCode
    }
  },
)

test.sequential(
  'should snapshot process environment for imperative invocation',
  async () => {
    const key = 'FUNC_ENVIRONMENT_TEST_VALUE'
    const previous = process.env[key]

    try {
      process.env[key] = 'before'
      const invocation = createInvoker(EnvironmentAppModule).invoke([])
      process.env[key] = 'after'
      const result = await invocation
      expect(result.result).toMatchObject({ [key]: 'before' })
    } finally {
      if (previous === undefined) {
        Reflect.deleteProperty(process.env, key)
      } else {
        process.env[key] = previous
      }
    }
  },
)

test('should use isolated environments for testing invocations', async () => {
  const app = createTestingApp(EnvironmentAppModule)
  const empty = await app.invoke([])
  const configured = await app.invoke([], {
    env: { REMOVED: undefined, VALUE: 'testing' },
  })

  expect(empty.result).toEqual({})
  expect(configured.result).toEqual({ VALUE: 'testing' })
})
