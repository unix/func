import {
  Catch,
  Command,
  Context,
  Handler,
  Injectable,
  Module,
  OutputHost,
  UseFilters,
} from '../src'
import type { ExceptionFilter, OnDispose, OnInit } from '../src'
import { createTestingApp } from '../src/subpath/testing'
import { expect, run, test } from './_test'

test.sequential(
  'should run module, command, and provider lifecycle in activation order',
  async () => {
    expect.assertions(2)
    const events: string[] = []
    const disposeArgumentCounts: number[] = []

    @Injectable()
    class Resource implements OnInit, OnDispose {
      onInit() {
        events.push('resource:init')
      }

      onDispose(...args: unknown[]) {
        disposeArgumentCounts.push(args.length)
        events.push('resource:dispose')
      }
    }

    @Command('deploy')
    class DeployCommand implements OnInit, OnDispose {
      constructor(_resource: Resource) {}

      onInit() {
        events.push('command:init')
      }

      @Handler()
      run() {
        events.push('handler')
        return 'ready'
      }

      onDispose(...args: unknown[]) {
        disposeArgumentCounts.push(args.length)
        events.push('command:dispose')
      }
    }

    @Module({ commands: [DeployCommand], providers: [Resource] })
    class DeployModule implements OnInit, OnDispose {
      onInit() {
        events.push('feature:init')
      }

      onDispose(...args: unknown[]) {
        disposeArgumentCounts.push(args.length)
        events.push('feature:dispose')
      }
    }

    @Module({ imports: [DeployModule] })
    class AppModule implements OnInit, OnDispose {
      onInit() {
        events.push('app:init')
      }

      onDispose(...args: unknown[]) {
        disposeArgumentCounts.push(args.length)
        events.push('app:dispose')
      }
    }

    await run(AppModule, { argv: ['deploy'] })
    expect(events).toEqual([
      'app:init',
      'feature:init',
      'resource:init',
      'command:init',
      'handler',
      'command:dispose',
      'feature:dispose',
      'app:dispose',
      'resource:dispose',
    ])
    expect(disposeArgumentCounts).toEqual([0, 0, 0, 0])
  },
)

test.sequential('should keep disposal independent from handled errors', async () => {
  expect.assertions(1)
  const events: string[] = []

  @Catch()
  class CommandFilter implements ExceptionFilter {
    catch() {
      events.push('command:error')
    }
  }

  @UseFilters(CommandFilter)
  @Command('deploy')
  class DeployCommand implements OnDispose {
    @Handler()
    run() {
      throw new Error('boom')
    }

    onDispose() {
      events.push('command:dispose')
    }
  }

  @Module({ commands: [DeployCommand] })
  class AppModule implements OnDispose {
    onDispose() {
      events.push('app:dispose')
    }
  }

  await run(AppModule, { argv: ['deploy'] })
  expect(events).toEqual(['command:error', 'command:dispose', 'app:dispose'])
})

test.sequential(
  'should settle context and deferred output before disposal',
  async () => {
    @Command('deploy')
    class DeployCommand {
      @Handler()
      run() {
        return 'ready'
      }
    }

    @Module({ commands: [DeployCommand] })
    class AppModule implements OnDispose {
      constructor(
        private readonly context: Context,
        private readonly output: OutputHost,
      ) {}

      onDispose() {
        this.output.defer('stdout', 'late output\n')
        this.context.exitCode = 9
      }
    }

    const result = await createTestingApp(AppModule).invoke(['deploy'])
    expect(result).toMatchObject({
      error: undefined,
      exitCode: 0,
      result: 'ready',
      stderr:
        'Lifecycle hook module "AppModule".onDispose() failed: Context.exitCode cannot change after invocation settlement.\n',
      stdout: '',
    })
  },
)

test.sequential('should continue disposing scopes after a fault', async () => {
  const events: string[] = []

  @Command('deploy')
  class DeployCommand implements OnDispose {
    @Handler()
    run() {
      return 'ready'
    }

    onDispose() {
      events.push('command:dispose')
      throw new Error('command cleanup failed')
    }
  }

  @Module({ commands: [DeployCommand] })
  class AppModule implements OnDispose {
    onDispose() {
      events.push('app:dispose')
    }
  }

  const result = await createTestingApp(AppModule).invoke(['deploy'])
  expect(events).toEqual(['command:dispose', 'app:dispose'])
  expect(result).toMatchObject({
    error: undefined,
    exitCode: 0,
    result: 'ready',
    stderr:
      'Lifecycle hook command "DeployCommand".onDispose() failed: command cleanup failed\n',
  })
})

test.sequential(
  'should activate only the root and direct command owner modules',
  async () => {
    const events: string[] = []

    @Command('deploy')
    class DeployCommand {
      @Handler()
      run() {
        events.push('command')
      }
    }

    @Module({ commands: [DeployCommand] })
    class DeployModule implements OnInit, OnDispose {
      onInit() {
        events.push('feature:init')
      }

      onDispose() {
        events.push('feature:dispose')
      }
    }

    @Module({ imports: [DeployModule] })
    class BridgeModule implements OnInit, OnDispose {
      onInit() {
        events.push('bridge:init')
      }

      onDispose() {
        events.push('bridge:dispose')
      }
    }

    @Module({ imports: [BridgeModule] })
    class AppModule implements OnInit, OnDispose {
      onInit() {
        events.push('app:init')
      }

      onDispose() {
        events.push('app:dispose')
      }
    }

    await run(AppModule, { argv: ['deploy'] })
    expect(events).toEqual([
      'app:init',
      'feature:init',
      'command',
      'feature:dispose',
      'app:dispose',
    ])
  },
)
