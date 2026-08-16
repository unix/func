import {
  Args,
  Command,
  Flag,
  Module,
  Handler,
  Injectable,
  Option,
  Required,
  Value,
} from '../src'
import type {
  Args as ArgsValue,
  ExecutionOutcome,
  OnDispose,
  OnError,
  OnInit,
} from '../src'
import { createTestingApp } from '../src/subpath/testing'
import { SYSTEM, applyClassDecorator, expect, systemErrorCode, test } from './_test'

test.sequential(
  'should bind and inject root module options for every invocation',
  async () => {
    expect.assertions(7)
    const events: string[] = []
    const instances = new Set<AppOptions>()

    @Option()
    class AppOptions implements OnInit, OnDispose {
      @Flag({ alias: 'j' })
      json = false

      @Value()
      profile: string = 'default'

      onInit() {
        events.push(`options:init:${this.json}:${this.profile}`)
      }

      onDispose(outcome: ExecutionOutcome) {
        events.push(`options:dispose:${outcome.status}`)
      }
    }

    @Injectable()
    class FeatureService {
      constructor(readonly options: AppOptions) {
        instances.add(options)
      }
    }

    @Command('deploy')
    class DeployCommand {
      constructor(private readonly feature: FeatureService) {}

      @Handler()
      run(@Args() args: ArgsValue) {
        return {
          args,
          json: this.feature.options.json,
          profile: this.feature.options.profile,
        }
      }
    }

    @Module({
      commands: [DeployCommand],
      providers: [FeatureService],
    })
    class FeatureModule {}

    @Module({
      imports: [FeatureModule],
      options: [AppOptions],
    })
    class AppModule implements OnDispose {
      constructor(private readonly options: AppOptions) {}

      onDispose(outcome: ExecutionOutcome) {
        events.push(
          `app:dispose:${outcome.status}:${this.options.json}:${this.options.profile}`,
        )
      }
    }

    const app = createTestingApp(AppModule)
    const configured = await app.invoke(['--profile', 'production', 'deploy', '-j'])
    const defaults = await app.invoke(['deploy'])
    expect(configured.error).toBeUndefined()
    expect(configured.result).toMatchObject({
      args: {
        invokedPath: ['deploy'],
        options: { json: true, profile: 'production' },
        raw: ['--profile', 'production', 'deploy', '-j'],
      },
      json: true,
      profile: 'production',
    })
    expect(defaults.error).toBeUndefined()
    expect(defaults.result).toMatchObject({
      args: {
        options: { json: false, profile: 'default' },
        raw: ['deploy'],
      },
      json: false,
      profile: 'default',
    })
    expect(instances.size).toBe(2)
    expect(events).toContain('app:dispose:success:true:production')
    expect(events).toEqual([
      'options:init:true:production',
      'app:dispose:success:true:production',
      'options:dispose:success',
      'options:init:false:default',
      'app:dispose:success:false:default',
      'options:dispose:success',
    ])
  },
)

test.sequential(
  'should scope feature options to directly owned commands',
  async () => {
    @Option()
    class DeployOptions {
      @Value()
      profile: string = 'deploy'
    }

    @Option()
    class ReportOptions {
      @Value()
      profile: string = 'report'
    }

    @Command('deploy')
    class DeployCommand {
      constructor(private readonly options: DeployOptions) {}

      @Handler()
      run() {
        return this.options.profile
      }
    }

    @Command('report')
    class ReportCommand {
      constructor(private readonly options: ReportOptions) {}

      @Handler()
      run() {
        return this.options.profile
      }
    }

    @Module({ commands: [DeployCommand], options: [DeployOptions] })
    class DeployModule {}

    @Module({ commands: [ReportCommand], options: [ReportOptions] })
    class ReportModule {}

    @Module({ imports: [DeployModule, ReportModule] })
    class AppModule {}

    const app = createTestingApp(AppModule)
    const deploy = await app.invoke(['deploy', '--profile', 'production'])
    const report = await app.invoke(['report', '--profile', 'weekly'])
    expect(deploy.result).toBe('production')
    expect(report.result).toBe('weekly')
  },
)

test.sequential('should not inherit options through module imports', async () => {
  @Option()
  class SharedOptions {
    @Flag()
    shared = false
  }

  @Command('deploy')
  class DeployCommand {
    @Handler()
    run() {}
  }

  @Module({ options: [SharedOptions] })
  class SharedModule {}

  @Module({ commands: [DeployCommand], imports: [SharedModule] })
  class DeployModule {}

  @Module({ imports: [DeployModule] })
  class AppModule {}

  const result = await createTestingApp(AppModule).invoke(['deploy', '--shared'])
  expect(result).toMatchObject({
    error: undefined,
    exitCode: 1,
    stderr: 'Unknown option: --shared.\n',
  })
})

test.sequential(
  'should route root option failures through the root module',
  async () => {
    let caught = false

    @Option()
    class AppOptions {
      @Required()
      @Value()
      profile?: string
    }

    @Module({ options: [AppOptions] })
    class AppModule implements OnError {
      constructor(private readonly options: AppOptions) {}

      onError() {
        caught = this.options.profile === undefined
      }
    }

    const result = await createTestingApp(AppModule).invoke()
    expect(caught).toBe(true)
    expect(result).toMatchObject({ error: undefined, exitCode: 1 })
  },
)

test.sequential(
  'should route feature option failures through their direct owner module',
  async () => {
    const events: string[] = []

    @Option()
    class DeployOptions {
      @Required()
      @Value()
      profile?: string
    }

    @Command('deploy')
    class DeployCommand {
      @Handler()
      run() {}
    }

    @Module({ commands: [DeployCommand], options: [DeployOptions] })
    class DeployModule implements OnError {
      constructor(private readonly options: DeployOptions) {}

      onError() {
        events.push(`feature:${this.options.profile ?? 'missing'}`)
      }
    }

    @Module({ imports: [DeployModule] })
    class AppModule implements OnError {
      onError() {
        events.push('app')
      }
    }

    const result = await createTestingApp(AppModule).invoke(['deploy'])
    expect(result).toMatchObject({ error: undefined, exitCode: 1 })
    expect(events).toEqual(['feature:missing'])
  },
)

test('should reject option tokens shared by root and command options', () => {
  @Option()
  class AppOptions {
    @Flag()
    verbose = false
  }

  @Command('build')
  class BuildCommand {
    @Flag()
    verbose = false

    @Handler()
    run() {}
  }

  @Module({ commands: [BuildCommand], options: [AppOptions] })
  class AppModule {}

  expect(() => createTestingApp(AppModule)).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.OPTION_OVERRIDE_REQUIRED),
    }),
  )
})

test('should reject option providers without Option', () => {
  @Injectable()
  class AppOptions {
    @Flag()
    verbose = false
  }

  @Module({ options: [AppOptions] })
  class AppModule {}

  expect(() => createTestingApp(AppModule)).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_OPTION_DECLARATION),
    }),
  )
})

test('should reject explicit provider definitions in module options', () => {
  @Option()
  class AppOptions {
    @Flag()
    verbose = false
  }

  class AppModule {}
  applyClassDecorator(
    Module,
    { options: [{ provide: AppOptions, useValue: new AppOptions() }] },
    AppModule,
  )

  expect(() => createTestingApp(AppModule)).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_OPTION_DECLARATION),
      message:
        'Module "AppModule" options must contain @Option or @OptionCommand classes.',
    }),
  )
})

test.sequential(
  'should bind CLI values into an overridden option provider',
  async () => {
    @Option()
    class AppOptions {
      @Value()
      profile: string = 'default'
    }

    @Command('deploy')
    class DeployCommand {
      constructor(private readonly options: AppOptions) {}

      @Handler()
      run() {
        return this.options.profile
      }
    }

    @Module({ commands: [DeployCommand], options: [AppOptions] })
    class AppModule {}

    const options = new AppOptions()
    const result = await createTestingApp(AppModule, {
      overrides: [{ provide: AppOptions, useValue: options }],
    }).invoke(['deploy', '--profile', 'production'])
    expect(result.result).toBe('production')
    expect(options.profile).toBe('production')
  },
)
