import {
  APP_FILTER,
  APP_INTERCEPTOR,
  Catch,
  Command,
  CommandMajor,
  Context,
  Handler,
  Injectable,
  MODULE_FILTER,
  MODULE_INTERCEPTOR,
  Module,
  UseFilters,
  UseInterceptors,
} from '../src'
import type { CallHandler, Exception, ExceptionFilter, Interceptor } from '../src'
import { RUNTIME, expect, run, test } from './_test'

test.sequential('should stop error propagation at a command filter', async () => {
  const events: string[] = []

  @Catch()
  class LocalFilter implements ExceptionFilter {
    catch() {
      events.push('command')
    }
  }

  @Catch()
  class AppFilter implements ExceptionFilter {
    catch() {
      events.push('app')
    }
  }

  @UseFilters(LocalFilter)
  @CommandMajor()
  class Major {
    @Handler()
    run() {
      throw new Error('boom')
    }
  }

  @Module({
    commands: [Major],
    providers: [{ provide: APP_FILTER, useClass: AppFilter }],
  })
  class AppModule {}

  await run(AppModule)
  expect(events).toEqual(['command'])
})

test.sequential('should expose the selected command to app filters', async () => {
  expect.assertions(1)

  @Catch()
  class AppFilter implements ExceptionFilter {
    constructor(private readonly context: Context) {}

    catch() {
      expect(this.context.command?.path).toEqual(['publish'])
    }
  }

  @Command('publish')
  class PublishCommand {
    @Handler()
    run() {
      throw new Error('boom')
    }
  }

  @Module({
    commands: [PublishCommand],
    providers: [{ provide: APP_FILTER, useClass: AppFilter }],
  })
  class AppModule {}

  await run(AppModule, { argv: ['publish'] })
})

test.sequential('should match error codes and original error classes', async () => {
  const events: string[] = []
  class DomainError extends Error {}

  @Catch(RUNTIME.HANDLER_ERROR)
  class CodeFilter implements ExceptionFilter {
    catch() {
      events.push('code')
      throw new DomainError('next')
    }
  }

  @Catch(DomainError)
  class ClassFilter implements ExceptionFilter {
    catch() {
      events.push('class')
    }
  }

  @UseFilters(CodeFilter, ClassFilter)
  @CommandMajor()
  class Major {
    @Handler()
    run() {
      throw new Error('boom')
    }
  }

  @Module({ commands: [Major] })
  class AppModule {}

  await run(AppModule)
  expect(events).toEqual(['code', 'class'])
})

test.sequential('should inherit command filter metadata', async () => {
  expect.assertions(1)

  @Catch()
  class LocalFilter implements ExceptionFilter {
    catch(exception: Exception) {
      expect(exception.message).toBe('boom')
    }
  }

  @UseFilters(LocalFilter)
  class BaseCommand {
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
  'should propagate errors through command, module, and app filters',
  async () => {
    const events: string[] = []

    @Catch()
    class CommandFilter implements ExceptionFilter {
      catch() {
        events.push('command')
        throw new Error('command failed')
      }
    }

    @Catch()
    class ModuleFilter implements ExceptionFilter {
      catch() {
        events.push('module')
        throw new Error('module failed')
      }
    }

    @Catch()
    class AppFilter implements ExceptionFilter {
      catch() {
        events.push('app')
      }
    }

    @UseFilters(CommandFilter)
    @Command('deploy')
    class DeployCommand {
      @Handler()
      run() {
        throw new Error('boom')
      }
    }

    @Module({
      commands: [DeployCommand],
      providers: [{ provide: MODULE_FILTER, useClass: ModuleFilter }],
    })
    class DeployModule {}

    @Module({
      imports: [DeployModule],
      providers: [{ provide: APP_FILTER, useClass: AppFilter }],
    })
    class AppModule {}

    await run(AppModule, { argv: ['deploy'] })
    expect(events).toEqual(['command', 'module', 'app'])
  },
)

test.sequential(
  'should apply app enhancers declared by an imported module globally',
  async () => {
    const events: string[] = []

    @Catch()
    class AppFilter implements ExceptionFilter {
      catch() {
        events.push('filter')
      }
    }

    @Injectable()
    class AppInterceptor implements Interceptor {
      async intercept(_context: Context, next: CallHandler) {
        events.push('before')
        const result = await next.handle()
        events.push('after')
        return result
      }
    }

    @Module({
      providers: [
        { provide: APP_FILTER, useClass: AppFilter },
        { provide: APP_INTERCEPTOR, useClass: AppInterceptor },
      ],
    })
    class EnhancerModule {}

    @Command('fail')
    class FailCommand {
      @Handler()
      run() {
        throw new Error('boom')
      }
    }

    @Module({ commands: [FailCommand] })
    class FeatureModule {}

    @Module({ imports: [EnhancerModule, FeatureModule] })
    class AppModule {}

    await run(AppModule, { argv: ['fail'] })
    expect(events).toEqual(['before', 'filter', 'after'])
  },
)

test.sequential('should run scoped interceptors around the handler', async () => {
  const events: string[] = []

  @Injectable()
  class AppInterceptor implements Interceptor {
    async intercept(_context: Context, next: CallHandler) {
      events.push('app:before')
      const result = await next.handle()
      events.push('app:after')
      return result
    }
  }

  @Injectable()
  class ModuleInterceptor implements Interceptor {
    async intercept(_context: Context, next: CallHandler) {
      events.push('module:before')
      const result = await next.handle()
      events.push('module:after')
      return result
    }
  }

  @Injectable()
  class CommandInterceptor implements Interceptor {
    async intercept(_context: Context, next: CallHandler) {
      events.push('command:before')
      const result = await next.handle()
      events.push('command:after')
      return result
    }
  }

  @UseInterceptors(CommandInterceptor)
  @Command('deploy')
  class DeployCommand {
    @Handler()
    run() {
      events.push('handler')
    }
  }

  @Module({
    commands: [DeployCommand],
    providers: [{ provide: MODULE_INTERCEPTOR, useClass: ModuleInterceptor }],
  })
  class DeployModule {}

  @Module({
    imports: [DeployModule],
    providers: [{ provide: APP_INTERCEPTOR, useClass: AppInterceptor }],
  })
  class AppModule {}

  await run(AppModule, { argv: ['deploy'] })
  expect(events).toEqual([
    'app:before',
    'module:before',
    'command:before',
    'handler',
    'command:after',
    'module:after',
    'app:after',
  ])
})

test.sequential(
  'should run application interceptors around invocation errors',
  async () => {
    const events: string[] = []

    @Injectable()
    class AppInterceptor implements Interceptor {
      async intercept(_context: Context, next: CallHandler) {
        events.push('before')
        const result = await next.handle()
        events.push('after')
        return result
      }
    }

    @Catch(RUNTIME.UNKNOWN_COMMAND)
    class AppFilter implements ExceptionFilter {
      catch() {
        events.push('filter')
        return { error: 'unknown command' }
      }
    }

    @Module({
      providers: [
        { provide: APP_FILTER, useClass: AppFilter },
        { provide: APP_INTERCEPTOR, useClass: AppInterceptor },
      ],
    })
    class AppModule {}

    const result = await run(AppModule, { argv: ['missing'] })
    expect(events).toEqual(['before', 'filter', 'after'])
    expect(result).toMatchObject({
      exitCode: 1,
      result: { error: 'unknown command' },
    })
  },
)
