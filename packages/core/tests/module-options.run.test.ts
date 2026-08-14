import {
  Args,
  Command,
  Flag,
  Handler,
  Injectable,
  Module,
  Option,
  OptionCommand,
  Override,
  Required,
  Value,
  createApp,
} from '../src'
import type { Args as ArgsValue } from '../src'
import { createTestingApp } from '../src/subpath/testing'
import { SYSTEM, expect, systemErrorCode, test } from './_test'

test.sequential(
  'should execute a root OptionCommand at a command namespace',
  async () => {
    @Option()
    class AppOptions {
      @Required()
      @Value()
      profile?: string
    }

    @OptionCommand({ alias: 'i', aliases: ['x', 'i'], name: 'inspect' })
    class InspectOption {
      constructor(private readonly options: AppOptions) {}

      @Handler()
      run(@Args() args: ArgsValue) {
        return {
          invokedPath: args.invokedPath,
          inspect: args.options.inspect,
          profile: this.options.profile,
        }
      }
    }

    @Command('users')
    class UsersCommand {
      @Handler('list')
      list() {
        return 'command'
      }
    }

    @Module({
      commands: [UsersCommand],
      options: [AppOptions, InspectOption],
    })
    class AppModule {}

    const result = await createTestingApp(AppModule).invoke(['users', '-i'])
    const secondAlias = await createTestingApp(AppModule).invoke(['users', '-x'])
    expect(result).toMatchObject({
      error: undefined,
      exitCode: 0,
      result: {
        inspect: true,
        invokedPath: ['users'],
        profile: undefined,
      },
    })
    expect(secondAlias.result).toMatchObject({ inspect: true })
  },
)

test.sequential(
  'should replace a root action in one module scope with overrideAll',
  async () => {
    @OptionCommand({ name: 'inspect' })
    class RootInspectOption {
      @Handler()
      run() {
        return 'root'
      }
    }

    @OptionCommand({ name: 'inspect', overrideAll: true })
    class FeatureInspectOption {
      @Handler()
      run() {
        return 'feature'
      }
    }

    @Command('root')
    class RootCommand {
      @Handler()
      run() {
        return 'root-command'
      }
    }

    @Command('feature')
    class FeatureCommand {
      @Handler()
      run() {
        return 'feature-command'
      }
    }

    @Module({
      commands: [FeatureCommand],
      options: [FeatureInspectOption],
    })
    class FeatureModule {}

    @Module({
      commands: [RootCommand],
      imports: [FeatureModule],
      options: [RootInspectOption],
    })
    class AppModule {}

    const app = createTestingApp(AppModule)
    const root = await app.invoke(['root', '--inspect'])
    const feature = await app.invoke(['feature', '--inspect'])
    expect(root.result).toBe('root')
    expect(feature.result).toBe('feature')
  },
)

test('should require overrideAll for an inherited OptionCommand token', () => {
  @OptionCommand({ name: 'inspect' })
  class RootInspectOption {
    @Handler()
    run() {}
  }

  @OptionCommand({ name: 'inspect' })
  class FeatureInspectOption {
    @Handler()
    run() {}
  }

  @Command('feature')
  class FeatureCommand {
    @Handler()
    run() {}
  }

  @Module({
    commands: [FeatureCommand],
    options: [FeatureInspectOption],
  })
  class FeatureModule {}

  @Module({ imports: [FeatureModule], options: [RootInspectOption] })
  class AppModule {}

  expect(() => createApp(AppModule)).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.OPTION_OVERRIDE_REQUIRED),
    }),
  )
})

test.sequential(
  'should replace an inherited provider field with a command field',
  async () => {
    @Option()
    class AppOptions {
      @Flag()
      verbose = false
    }

    @Command('build')
    class BuildCommand {
      @Override()
      @Flag()
      verbose = false

      constructor(private readonly appOptions: AppOptions) {}

      @Handler()
      run() {
        return {
          global: this.appOptions.verbose,
          local: this.verbose,
        }
      }
    }

    @Module({ commands: [BuildCommand], options: [AppOptions] })
    class AppModule {}

    const result = await createTestingApp(AppModule).invoke(['--verbose', 'build'])
    expect(result.result).toEqual({ global: false, local: true })
  },
)

test('should reject Override without exactly one field option', () => {
  @Command('build')
  class BuildCommand {
    @Override()
    value = false

    @Handler()
    run() {}
  }

  @Module({ commands: [BuildCommand] })
  class AppModule {}

  expect(() => createApp(AppModule)).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_OVERRIDE_TARGET),
    }),
  )
})

test('should reject invalid OptionCommand shapes', () => {
  @OptionCommand({ name: 'inspect' })
  class InspectOption {
    @Handler('details')
    run() {}
  }

  @Module({ options: [InspectOption] })
  class AppModule {}

  expect(() => createApp(AppModule)).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_OPTION_DECLARATION),
    }),
  )
})

test('should reject Handler methods on injectable services', () => {
  @Injectable()
  class InvalidService {
    @Handler()
    run() {}
  }

  @Module({ providers: [InvalidService] })
  class AppModule {}

  expect(() => createApp(AppModule)).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.UNKNOWN_HANDLER),
    }),
  )
})

test.sequential('should report an ambiguous pre-command override', async () => {
  @Option()
  class AppOptions {
    @Value()
    mode?: string
  }

  @Command('build')
  class BuildCommand {
    @Override()
    @Flag()
    mode = false

    @Handler()
    run() {}
  }

  @Module({ commands: [BuildCommand], options: [AppOptions] })
  class AppModule {}

  const result = await createTestingApp(AppModule).invoke(['--mode', 'build'])
  expect(result).toMatchObject({
    error: undefined,
    exitCode: 1,
  })
  expect(result.stderr).toContain('multiple command scopes')
})
