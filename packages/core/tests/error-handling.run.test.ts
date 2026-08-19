import {
  Command,
  CommandMajor,
  Context,
  Handler,
  Injectable,
  Module,
  OptionCommand,
} from '../src'
import type { Exception, OnDispose, OnError, OnInit } from '../src'
import { expect, run, test } from './_test'

test.sequential('should stop error propagation at the command hook', async () => {
  const events: string[] = []

  @CommandMajor()
  class Major implements OnError {
    onError() {
      events.push('command')
    }

    @Handler()
    run() {
      throw new Error('boom')
    }
  }

  @Module({ commands: [Major] })
  class AppModule implements OnError {
    onError() {
      events.push('app')
    }
  }

  await run(AppModule)
  expect(events).toEqual(['command'])
})

test.sequential('should expose the resolved context to onError', async () => {
  expect.assertions(3)

  @Command('publish')
  class PublishCommand {
    @Handler()
    run() {
      throw new Error('boom')
    }
  }

  @Module({ commands: [PublishCommand] })
  class AppModule implements OnError {
    onError(_exception: Exception, context: Context) {
      expect(context.invocation.resolved).toBe(true)
      expect(context.command?.path).toEqual(['publish'])
      expect(context.options).toEqual({})
    }
  }

  await run(AppModule, { argv: ['publish'] })
})

test.sequential('should expose an unresolved context for parse errors', async () => {
  expect.assertions(2)

  @CommandMajor()
  class Major {
    @Handler()
    run() {}
  }

  @Module({ commands: [Major] })
  class AppModule implements OnError {
    onError(_exception: Exception, context: Context) {
      expect(context.invocation).toEqual({ resolved: false })
      expect(context.command).toBeUndefined()
    }
  }

  await run(AppModule, { argv: ['--unknown'] })
})

test.sequential('should inherit the command onError hook', async () => {
  expect.assertions(1)

  class BaseCommand implements OnError {
    onError(exception: Exception) {
      expect(exception.message).toBe('boom')
    }

    @Handler()
    run() {
      throw new Error('boom')
    }
  }

  @CommandMajor()
  class Major extends BaseCommand {}

  @Module({ commands: [Major] })
  class AppModule {}

  await run(AppModule)
})

test.sequential(
  'should route service method errors through the calling command',
  async () => {
    const events: string[] = []

    @Injectable()
    class ProjectService implements OnError {
      fail() {
        throw new Error('service failed')
      }

      onError() {
        events.push('service')
      }
    }

    @CommandMajor()
    class Major implements OnError {
      constructor(private readonly service: ProjectService) {}

      @Handler()
      run() {
        this.service.fail()
      }

      onError() {
        events.push('command')
      }
    }

    @Module({ commands: [Major], providers: [ProjectService] })
    class AppModule {}

    await run(AppModule)
    expect(events).toEqual(['command'])
  },
)

test.sequential(
  'should route option command initialization errors locally',
  async () => {
    const events: string[] = []

    @OptionCommand({ name: 'version' })
    class VersionOption implements OnError, OnInit {
      @Handler()
      run() {}

      onInit() {
        throw new Error('version init failed')
      }

      onError() {
        events.push('option:error')
      }
    }

    @Module({ options: [VersionOption] })
    class AppModule implements OnError {
      onError() {
        events.push('app:error')
      }
    }

    await run(AppModule, { argv: ['--version'] })
    expect(events).toEqual(['option:error'])
  },
)

test.sequential(
  'should propagate errors through command, module, and app hooks',
  async () => {
    const events: string[] = []

    @Command('deploy')
    class DeployCommand implements OnError {
      onError() {
        events.push('command')
        throw new Error('command failed')
      }

      @Handler()
      run() {
        throw new Error('boom')
      }
    }

    @Module({ commands: [DeployCommand] })
    class DeployModule implements OnError {
      onError() {
        events.push('module')
        throw new Error('module failed')
      }
    }

    @Module({ imports: [DeployModule] })
    class AppModule implements OnError {
      onError() {
        events.push('app')
      }
    }

    await run(AppModule, { argv: ['deploy'] })
    expect(events).toEqual(['command', 'module', 'app'])
  },
)

test.sequential('should route module initialization errors outward', async () => {
  const events: string[] = []

  @Command('feature')
  class FeatureCommand {
    @Handler()
    run() {}
  }

  @Module({ commands: [FeatureCommand] })
  class FeatureModule implements OnError, OnInit {
    onError() {
      events.push('feature:error')
      throw new Error('feature onError failed')
    }

    onInit() {
      events.push('feature:init')
      throw new Error('feature init failed')
    }
  }

  @Module({ imports: [FeatureModule] })
  class AppModule implements OnError {
    onError() {
      events.push('app:error')
    }
  }

  await run(AppModule, { argv: ['feature'] })
  expect(events).toEqual(['feature:init', 'feature:error', 'app:error'])
})

test.sequential(
  'should route disposal errors after completing remaining cleanup',
  async () => {
    const events: string[] = []

    @CommandMajor()
    class Major implements OnDispose, OnError {
      onDispose() {
        events.push('command:dispose')
        throw new Error('dispose failed')
      }

      onError() {
        events.push('command:error')
        throw new Error('command onError failed')
      }

      @Handler()
      run() {
        events.push('handler')
      }
    }

    @Module({ commands: [Major] })
    class AppModule implements OnDispose, OnError {
      onDispose() {
        events.push('app:dispose')
      }

      onError() {
        events.push('app:error')
      }
    }

    await run(AppModule)
    expect(events).toEqual([
      'handler',
      'command:dispose',
      'app:dispose',
      'command:error',
      'app:error',
    ])
  },
)
