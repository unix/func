import { Command, Exception, Module, Handler, Injectable, run } from '../src'
import type { ExecutionOutcome, OnDispose, OnError, OnInit } from '../src'
import { expect, test } from './_test'

test.sequential(
  'should run module, command, and provider lifecycle in activation order',
  async () => {
    expect.assertions(3)
    const events: string[] = []
    const outcomes = new Set<ExecutionOutcome>()

    @Injectable()
    class Resource implements OnInit, OnDispose {
      onInit() {
        events.push('resource:init')
      }

      onDispose(outcome: ExecutionOutcome) {
        outcomes.add(outcome)
        events.push(`resource:dispose:${outcome.status}`)
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

      onDispose(outcome: ExecutionOutcome) {
        outcomes.add(outcome)
        events.push(`command:dispose:${outcome.status}`)
      }
    }

    @Module({ commands: [DeployCommand], providers: [Resource] })
    class DeployModule implements OnInit, OnDispose {
      onInit() {
        events.push('feature:init')
      }

      onDispose(outcome: ExecutionOutcome) {
        outcomes.add(outcome)
        events.push(`feature:dispose:${outcome.status}`)
      }
    }

    @Module({ imports: [DeployModule] })
    class AppModule implements OnInit, OnDispose {
      onInit() {
        events.push('app:init')
      }

      onDispose(outcome: ExecutionOutcome) {
        outcomes.add(outcome)
        events.push(`app:dispose:${outcome.status}`)
      }
    }

    await run(AppModule, { argv: ['deploy'] })
    expect(events).toEqual([
      'app:init',
      'feature:init',
      'resource:init',
      'command:init',
      'handler',
      'command:dispose:success',
      'feature:dispose:success',
      'app:dispose:success',
      'resource:dispose:success',
    ])
    expect(outcomes.size).toBe(1)
    expect(Object.isFrozen([...outcomes][0])).toBe(true)
  },
)

test.sequential('should pass handled errors to every dispose hook', async () => {
  expect.assertions(1)
  const events: string[] = []

  @Command('deploy')
  class DeployCommand implements OnError, OnDispose {
    @Handler()
    run() {
      throw new Error('boom')
    }

    onError(_exception: Exception) {
      events.push('command:error')
    }

    onDispose(outcome: ExecutionOutcome) {
      events.push(`command:dispose:${outcome.status}`)
    }
  }

  @Module({ commands: [DeployCommand] })
  class AppModule implements OnError, OnDispose {
    onError() {
      events.push('app:error')
    }

    onDispose(outcome: ExecutionOutcome) {
      events.push(
        `app:dispose:${outcome.status}:${outcome.status === 'error' && outcome.handled}`,
      )
    }
  }

  await run(AppModule, { argv: ['deploy'] })
  expect(events).toEqual([
    'command:error',
    'command:dispose:error',
    'app:dispose:error:true',
  ])
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
