import {
  Command,
  CommandMajor,
  Context,
  Module,
  Handler,
  Injectable,
  createApp,
  run,
} from '../src'
import { SYSTEM, expect, random, systemErrorCode, test } from './_test'

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
  expect(() => createApp({ commands: [] } as never)).toThrow(
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

test.sequential('should create a low-level container from a Module', async () => {
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
    expect.objectContaining({ run: expect.any(Function) }),
  )
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
