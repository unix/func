import {
  Command,
  CommandMajor,
  Context,
  Module,
  Handler,
  Injectable,
  createApp,
} from '../src'
import {
  SYSTEM,
  anyValue,
  expect,
  invokeUnchecked,
  random,
  run,
  systemErrorCode,
  test,
} from './_test'

test.sequential('should run commands from a Module', async () => {
  let invoked = false
  const name = random()

  @Command(name)
  class BuildCommand {
    @Handler()
    run() {
      invoked = true
    }
  }

  @Module({
    commands: [BuildCommand],
  })
  class AppModule {}

  await run(AppModule, { argv: [name] })
  expect(invoked).toBe(true)
})

test.sequential(
  'should register imported commands in compiled module order',
  async () => {
    expect.assertions(1)

    @Command('shared')
    class SharedCommand {
      @Handler()
      run() {}
    }

    @Command('first')
    class FirstCommand {
      @Handler()
      run() {}
    }

    @Command('second')
    class SecondCommand {
      @Handler()
      run() {}
    }

    @CommandMajor()
    class Major {
      constructor(private readonly context: Context) {}

      @Handler()
      run() {
        expect(this.context.commands.map(command => command.path.join(' '))).toEqual(
          ['shared', 'first', 'second'],
        )
      }
    }

    @Module({ commands: [SharedCommand] })
    class SharedModule {}

    @Module({
      commands: [FirstCommand],
      imports: [SharedModule],
    })
    class FirstModule {}

    @Module({
      commands: [SecondCommand],
      imports: [SharedModule],
    })
    class SecondModule {}

    @Module({
      commands: [Major],
      imports: [FirstModule, SecondModule],
    })
    class AppModule {}

    await run(AppModule, { argv: [] })
  },
)

test('should reject a plain app config', () => {
  expect(() => invokeUnchecked(createApp, { commands: [] })).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_MODULE_INPUT),
      details: { module: '(module config)' },
    }),
  )
})

test('should reject a command class as application input', () => {
  @Command('build')
  class BuildCommand {
    @Handler()
    run() {}
  }

  expect(() => createApp(BuildCommand)).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_MODULE_INPUT),
      details: { module: 'BuildCommand' },
    }),
  )
})

test('should require subclasses to declare their own module metadata', () => {
  @Module({})
  class BaseModule {}

  class ChildModule extends BaseModule {}

  expect(() => createApp(ChildModule)).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_MODULE_INPUT),
      details: { module: 'ChildModule' },
    }),
  )
})

test.sequential('should create a bootstrap application from a Module', async () => {
  @CommandMajor()
  class Major {
    @Handler()
    run() {}
  }

  @Module({
    commands: [Major],
  })
  class AppModule {}

  expect(createApp(AppModule)).toEqual(
    expect.objectContaining({ bootstrap: anyValue(Function) }),
  )
})

test.sequential('should expose the configured application name', async () => {
  expect.assertions(1)

  @CommandMajor()
  class Major {
    constructor(private readonly context: Context) {}

    @Handler()
    run() {
      expect(this.context.appName).toBe('func-test')
    }
  }

  @Module({ commands: [Major] })
  class AppModule {}

  const previousExitCode = process.exitCode
  const app = createApp(AppModule, { appName: 'func-test' })
  try {
    await app.bootstrap({ argv: [] })
  } finally {
    process.exitCode = previousExitCode
  }
})

test('should collect an application name without interpreting it', () => {
  @Module({})
  class AppModule {}

  expect(() => createApp(AppModule, { appName: '../opaque' })).not.toThrow()
})

test.sequential('should bootstrap a process application only once', async () => {
  let invoked = false
  const previousExitCode = process.exitCode

  @CommandMajor()
  class Major {
    @Handler()
    run() {
      invoked = true
    }
  }

  @Module({ commands: [Major] })
  class AppModule {}

  const app = createApp(AppModule)
  try {
    await expect(app.bootstrap({ argv: [] })).resolves.toBeUndefined()
    expect(invoked).toBe(true)
    await expect(app.bootstrap({ argv: [] })).rejects.toMatchObject({
      code: 'F_RUNTIME_APPLICATION_ALREADY_BOOTSTRAPPED',
      message: 'An application can only be bootstrapped once.',
    })
  } finally {
    process.exitCode = previousExitCode
  }
})

test.sequential(
  'should inject providers registered by a feature module',
  async () => {
    let message = ''
    const name = random()

    @Injectable()
    class FeatureService {
      text() {
        return 'feature-service'
      }
    }

    @Command(name)
    class FeatureCommand {
      constructor(private service: FeatureService) {}

      @Handler()
      run() {
        message = this.service.text()
      }
    }

    @Module({
      commands: [FeatureCommand],
      providers: [FeatureService],
    })
    class FeatureModule {}

    @Module({
      imports: [FeatureModule],
    })
    class AppModule {}

    await run(AppModule, { argv: [name] })
    expect(message).toBe('feature-service')
  },
)

test.sequential(
  'should inject dependencies between registered providers',
  async () => {
    let invoked = false
    const name = random()

    @Injectable()
    class ProjectService {
      name() {
        return name
      }
    }

    @Injectable()
    class FeatureService {
      constructor(private project: ProjectService) {}

      matches(input: string) {
        return this.project.name() === input
      }
    }

    @Command(name)
    class FeatureCommand {
      constructor(private service: FeatureService) {}

      @Handler()
      run() {
        invoked = this.service.matches(name)
      }
    }

    @Module({
      commands: [FeatureCommand],
      providers: [ProjectService, FeatureService],
    })
    class AppModule {}

    await run(AppModule, { argv: [name] })
    expect(invoked).toBe(true)
  },
)
