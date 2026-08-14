import {
  CommandMajor,
  Module,
  Handler,
  Inject,
  Injectable,
  createApp,
  createToken,
  run,
} from '../src'
import {
  RUNTIME,
  SYSTEM,
  expect,
  runtimeErrorCode,
  systemErrorCode,
  test,
  testModule,
} from './_test'

test('should reject providers without Injectable', () => {
  class ProjectService {}

  expect(() => createApp(testModule({ providers: [ProjectService] }))).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_PROVIDER),
    }),
  )
})

test('should require provider subclasses to declare Injectable', () => {
  @Injectable()
  class BaseService {}

  class ProjectService extends BaseService {}

  expect(() => createApp(testModule({ providers: [ProjectService] }))).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_PROVIDER),
    }),
  )
})

test('should reject duplicate provider tokens', () => {
  const PROJECT = createToken<string>('PROJECT')

  expect(() =>
    createApp(
      testModule({
        providers: [
          { provide: PROJECT, useValue: 'first' },
          { provide: PROJECT, useValue: 'second' },
        ],
      }),
    ),
  ).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.DUPLICATE_PROVIDER),
    }),
  )
})

test('should allow duplicate private provider tokens across modules', () => {
  const PROJECT = createToken<string>('PROJECT')

  @Module({ providers: [{ provide: PROJECT, useValue: 'first' }] })
  class FirstModule {}

  @Module({ providers: [{ provide: PROJECT, useValue: 'second' }] })
  class SecondModule {}

  @Module({ imports: [FirstModule, SecondModule] })
  class AppModule {}

  expect(() => createApp(AppModule)).not.toThrow()
})

test.sequential('should report missing explicit providers', async () => {
  const PROJECT = createToken<string>('PROJECT')

  @CommandMajor()
  class Major {
    @Handler()
    run(@Inject(PROJECT) _project: string) {}
  }

  await expect(
    run(testModule({ commands: [Major] }), { argv: [] }),
  ).rejects.toMatchObject({
    code: systemErrorCode(SYSTEM.MISSING_PROVIDER),
    details: {
      token: 'PROJECT',
    },
  })
})

test.sequential('should reject unregistered inferred dependencies', async () => {
  @Injectable()
  class ProjectService {}

  @CommandMajor()
  class Major {
    constructor(_project: ProjectService) {}

    @Handler()
    run() {}
  }

  await expect(
    run(testModule({ commands: [Major] }), { argv: [] }),
  ).rejects.toMatchObject({
    code: systemErrorCode(SYSTEM.MISSING_PROVIDER),
    details: {
      requester: 'TestModule',
      token: 'ProjectService',
    },
  })
})

test.sequential('should report circular provider dependencies', async () => {
  const FIRST = createToken<unknown>('FIRST')
  const SECOND = createToken<unknown>('SECOND')

  @Injectable()
  class FirstService {
    constructor(@Inject(SECOND) _second: unknown) {}
  }

  @Injectable()
  class SecondService {
    constructor(@Inject(FIRST) _first: unknown) {}
  }

  @CommandMajor()
  class Major {
    constructor(@Inject(FIRST) _first: unknown) {}

    @Handler()
    run() {}
  }

  @Module({
    commands: [Major],
    providers: [
      { provide: FIRST, useClass: FirstService },
      { provide: SECOND, useClass: SecondService },
    ],
  })
  class AppModule {}

  await expect(run(AppModule, { argv: [] })).rejects.toMatchObject({
    code: systemErrorCode(SYSTEM.CIRCULAR_PROVIDER_DEPENDENCY),
    details: {
      dependencyPath: ['FIRST', 'SECOND', 'FIRST'],
    },
  })
})

test.sequential('should identify provider construction failures', async () => {
  @Injectable()
  class ProjectService {
    constructor() {
      throw new Error('construction failed')
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
    details: {
      token: 'ProjectService',
    },
  })
})
