import {
  Command,
  CommandMajor,
  Context,
  Enum,
  Exception,
  ExceptionContext,
  Module,
  Handler,
  Value,
  run,
} from '../src'
import type { OnError } from '../src'
import { expect, random, test } from './_test'

test.sequential('should stop error propagation at the command hook', async () => {
  expect.assertions(5)
  let localCaught = false
  let globalCaught = false

  @CommandMajor()
  class Major implements OnError {
    @Enum(['dev'])
    @Value()
    mode: string = 'dev'

    onError(exception: Exception, context: ExceptionContext) {
      localCaught = true
      expect(exception).toBeInstanceOf(Exception)
      expect(context).toBeInstanceOf(ExceptionContext)
      expect(exception.message).toContain('must be one of')
      context.preventDefaultPrint()
    }

    @Handler()
    run() {}
  }

  @Module({ commands: [Major] })
  class AppModule implements OnError {
    onError() {
      globalCaught = true
    }
  }

  await run(AppModule, { argv: ['--mode', 'prod'] })
  expect(localCaught).toBe(true)
  expect(globalCaught).toBe(false)
})

test.sequential('should expose the selected command to app errors', async () => {
  expect.assertions(1)
  const name = random()

  @Command(name)
  class PublishCommand {
    @Handler()
    run() {
      throw new Error('boom')
    }
  }

  @Module({ commands: [PublishCommand] })
  class AppModule implements OnError {
    constructor(private readonly context: Context) {}

    onError() {
      expect(this.context.command?.path).toEqual([name])
    }
  }

  await run(AppModule, { argv: [name] })
})

test.sequential('should inherit onError methods', async () => {
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

  await run(AppModule, { argv: [] })
})

test.sequential(
  'should propagate command errors through owner and root modules',
  async () => {
    expect.assertions(1)
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
        events.push('feature')
        throw new Error('feature failed')
      }
    }

    @Module({ imports: [DeployModule] })
    class AppModule implements OnError {
      onError() {
        events.push('app')
      }
    }

    await run(AppModule, { argv: ['deploy'] })
    expect(events).toEqual(['command', 'feature', 'app'])
  },
)
