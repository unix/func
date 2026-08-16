import {
  CommandMajor,
  Module,
  Handler,
  Inject,
  Injectable,
  createToken,
} from '../src'
import type { OnError } from '../src'
import { createInvoker } from '../src/subpath/invoke'
import { expect, run, test, testModule } from './_test'

test.sequential('should resolve every provider definition', async () => {
  expect.assertions(3)
  const PROJECT_NAME = createToken<string>('PROJECT_NAME')
  const FORMATTED_NAME = createToken<string>('FORMATTED_NAME')

  @Injectable()
  class ProjectService {
    constructor(@Inject(PROJECT_NAME) private name: string) {}

    value() {
      return this.name
    }
  }

  @Injectable()
  class ProjectAlias {
    constructor(private project: ProjectService) {}

    value() {
      return this.project.value()
    }
  }

  @CommandMajor()
  class Major {
    constructor(
      private project: ProjectService,
      @Inject(ProjectAlias) private alias: ProjectAlias,
    ) {}

    @Handler()
    run(@Inject(FORMATTED_NAME) formattedName: string) {
      expect(this.project.value()).toBe('func')
      expect(this.alias.value()).toBe('func')
      expect(formattedName).toBe('FUNC')
    }
  }

  @Module({
    commands: [Major],
    providers: [
      ProjectService,
      {
        provide: PROJECT_NAME,
        useValue: 'func',
      },
      {
        provide: ProjectAlias,
        useClass: ProjectAlias,
      },
      {
        provide: FORMATTED_NAME,
        inject: [PROJECT_NAME],
        async useFactory(name: string) {
          await Promise.resolve()
          return name.toUpperCase()
        },
      },
    ],
  })
  class AppModule {}

  await run(AppModule, { argv: [] })
})

test.sequential(
  'should inherit provider constructor injection metadata',
  async () => {
    expect.assertions(1)
    const PROJECT_NAME = createToken<string>('PROJECT_NAME')

    @Injectable()
    class BaseService {
      constructor(@Inject(PROJECT_NAME) readonly name: string) {}
    }

    @Injectable()
    class ProjectService extends BaseService {}

    @CommandMajor()
    class Major {
      constructor(private project: ProjectService) {}

      @Handler()
      run() {
        expect(this.project.name).toBe('func')
      }
    }

    await run(
      testModule({
        commands: [Major],
        providers: [ProjectService, { provide: PROJECT_NAME, useValue: 'func' }],
      }),
      { argv: [] },
    )
  },
)

test.sequential(
  'should lazily share providers within one invocation and recreate them for the next run',
  async () => {
    expect.assertions(5)
    let created = 0
    let firstInstance: ProjectService | undefined

    @Injectable()
    class ProjectService {
      id = ++created
    }

    @Injectable()
    class UnusedService {
      constructor() {
        throw new Error('unused providers must remain lazy')
      }
    }

    @CommandMajor()
    class Major {
      constructor(private project: ProjectService) {
        firstInstance = project
      }

      @Handler()
      run(project: ProjectService) {
        expect(project).toBe(firstInstance)
        expect(project.id).toBe(created)
      }
    }

    @Module({
      commands: [Major],
      providers: [ProjectService, UnusedService],
    })
    class AppModule {}

    const invoker = createInvoker(AppModule)
    await invoker.invoke([])
    await invoker.invoke([])
    expect(created).toBe(2)
  },
)

test.sequential(
  'should share providers with the global error handler in the same invocation',
  async () => {
    expect.assertions(1)
    let commandInstance: InvocationService | undefined

    @Injectable()
    class InvocationService {}

    @CommandMajor()
    class Major {
      constructor(service: InvocationService) {
        commandInstance = service
      }

      @Handler()
      run() {
        throw new Error('boom')
      }
    }

    @Module({
      commands: [Major],
      providers: [InvocationService],
    })
    class AppModule implements OnError {
      constructor(private readonly service: InvocationService) {}

      onError() {
        expect(this.service).toBe(commandInstance)
      }
    }

    await run(AppModule, { argv: [] })
  },
)
