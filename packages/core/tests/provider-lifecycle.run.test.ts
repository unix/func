import {
  APP_FILTER,
  Catch,
  CommandMajor,
  Module,
  Handler,
  Inject,
  Injectable,
  createToken,
} from '../src'
import type { ExceptionFilter, OnDispose, OnInit } from '../src'
import { createTestingApp } from '../src/subpath/testing'
import { RUNTIME, expect, run, runtimeErrorCode, test, testModule } from './_test'

test.sequential(
  'should initialize lazily and dispose in reverse order',
  async () => {
    expect.assertions(1)
    const events: string[] = []

    @Injectable()
    class DependencyService implements OnInit, OnDispose {
      onInit() {
        events.push('dependency:init')
      }

      onDispose() {
        events.push('dependency:dispose')
      }
    }

    @Injectable()
    class ProjectService implements OnInit, OnDispose {
      constructor(_dependency: DependencyService) {
        events.push('project:create')
      }

      onInit() {
        events.push('project:init')
      }

      onDispose() {
        events.push('project:dispose')
      }
    }

    @Injectable()
    class UnusedService implements OnInit {
      onInit() {
        events.push('unused:init')
      }
    }

    @CommandMajor()
    class Major {
      constructor(_project: ProjectService) {}

      @Handler()
      run() {
        events.push('handler')
      }
    }

    @Module({
      commands: [Major],
      providers: [DependencyService, ProjectService, UnusedService],
    })
    class AppModule {}

    await run(AppModule, { argv: [] })
    expect(events).toEqual([
      'dependency:init',
      'project:create',
      'project:init',
      'handler',
      'project:dispose',
      'dependency:dispose',
    ])
  },
)

test.sequential('should dispose a provider after initialization fails', async () => {
  expect.assertions(2)
  let disposed = false

  @Injectable()
  class ProjectService implements OnInit, OnDispose {
    onInit() {
      throw new Error('init failed')
    }

    onDispose() {
      disposed = true
    }
  }

  @CommandMajor()
  class Major {
    constructor(_project: ProjectService) {}

    @Handler()
    run() {}
  }

  await expect(
    run(testModule({ commands: [Major], providers: [ProjectService] }), {
      argv: [],
    }),
  ).rejects.toMatchObject({
    code: runtimeErrorCode(RUNTIME.PROVIDER_INIT),
  })
  expect(disposed).toBe(true)
})

test.sequential('should not dispose useValue providers', async () => {
  expect.assertions(1)
  const PROJECT = createToken<{ onDispose(): void }>('PROJECT')
  let disposed = false

  @CommandMajor()
  class Major {
    constructor(@Inject(PROJECT) _project: { onDispose(): void }) {}

    @Handler()
    run() {}
  }

  await run(
    testModule({
      commands: [Major],
      providers: [
        {
          provide: PROJECT,
          useValue: {
            onDispose() {
              disposed = true
            },
          },
        },
      ],
    }),
    { argv: [] },
  )
  expect(disposed).toBe(false)
})

test.sequential('should run lifecycle hooks for factory providers', async () => {
  expect.assertions(1)
  const PROJECT = createToken<ProjectResource>('PROJECT')
  const events: string[] = []

  class ProjectResource implements OnInit, OnDispose {
    onInit() {
      events.push('init')
    }

    onDispose() {
      events.push('dispose')
    }
  }

  @CommandMajor()
  class Major {
    constructor(@Inject(PROJECT) _project: ProjectResource) {}

    @Handler()
    run() {
      events.push('handler')
    }
  }

  await run(
    testModule({
      commands: [Major],
      providers: [{ provide: PROJECT, useFactory: () => new ProjectResource() }],
    }),
    { argv: [] },
  )
  expect(events).toEqual(['init', 'handler', 'dispose'])
})

test.sequential(
  'should initialize and dispose the same factory object only once',
  async () => {
    expect.assertions(3)
    const FIRST = createToken<SharedResource>('FIRST')
    const SECOND = createToken<SharedResource>('SECOND')
    let initialized = 0
    let disposed = 0

    class SharedResource implements OnInit, OnDispose {
      onInit() {
        initialized += 1
      }

      onDispose() {
        disposed += 1
      }
    }

    const shared = new SharedResource()

    @CommandMajor()
    class Major {
      constructor(
        @Inject(FIRST) first: SharedResource,
        @Inject(SECOND) second: SharedResource,
      ) {
        expect(first).toBe(second)
      }

      @Handler()
      run() {}
    }

    await run(
      testModule({
        commands: [Major],
        providers: [
          { provide: FIRST, useFactory: () => shared },
          { provide: SECOND, useFactory: () => shared },
        ],
      }),
      { argv: [] },
    )
    expect(initialized).toBe(1)
    expect(disposed).toBe(1)
  },
)

test.sequential(
  'should dispose providers created by commands and global error handlers',
  async () => {
    expect.assertions(1)
    const events: string[] = []

    @Injectable()
    class CommandResource implements OnDispose {
      onDispose() {
        events.push('command:dispose')
      }
    }

    @Injectable()
    class ErrorResource implements OnDispose {
      onDispose() {
        events.push('error:dispose')
      }
    }

    @CommandMajor()
    class Major {
      constructor(_resource: CommandResource) {}

      @Handler()
      run() {
        throw new Error('boom')
      }
    }

    @Catch()
    class AppFilter implements ExceptionFilter {
      constructor(_resource: ErrorResource) {}

      catch() {}
    }

    @Module({
      commands: [Major],
      providers: [
        CommandResource,
        ErrorResource,
        { provide: APP_FILTER, useClass: AppFilter },
      ],
    })
    class AppModule {}

    await run(AppModule, { argv: [] })
    expect(events).toEqual(['command:dispose', 'error:dispose'])
  },
)

test.sequential(
  'should absorb provider disposal failures outside the filter chain',
  async () => {
    let caught = 0

    @Injectable()
    class ProjectService implements OnDispose {
      onDispose() {
        throw new Error('dispose failed')
      }
    }

    @CommandMajor()
    class Major {
      constructor(_project: ProjectService) {}

      @Handler()
      run() {
        return 'ready'
      }
    }

    @Catch()
    class AppFilter implements ExceptionFilter {
      catch() {
        caught += 1
      }
    }

    const result = await createTestingApp(
      testModule({
        commands: [Major],
        providers: [ProjectService, { provide: APP_FILTER, useClass: AppFilter }],
      }),
    ).invoke()
    expect(result).toMatchObject({
      error: undefined,
      exitCode: 0,
      result: 'ready',
      stderr:
        'Lifecycle hook provider "ProjectService".onDispose() failed: dispose failed\n',
    })
    expect(caught).toBe(0)
  },
)

test.sequential('should aggregate every provider disposal failure', async () => {
  @Injectable()
  class FirstService implements OnDispose {
    onDispose() {
      throw new Error('first dispose failed')
    }
  }

  @Injectable()
  class SecondService implements OnDispose {
    onDispose() {
      throw new Error('second dispose failed')
    }
  }

  @CommandMajor()
  class Major {
    constructor(_first: FirstService, _second: SecondService) {}

    @Handler()
    run() {}
  }

  const result = await createTestingApp(
    testModule({
      commands: [Major],
      providers: [FirstService, SecondService],
    }),
  ).invoke()
  expect(result.error).toBeUndefined()
  expect(result.stderr).toBe(
    'Lifecycle hook provider "SecondService".onDispose() failed: second dispose failed\n' +
      'Lifecycle hook provider "FirstService".onDispose() failed: first dispose failed\n',
  )
})
