import {
  Catch,
  Command,
  CommandMajor,
  Module,
  Handler,
  Inject,
  Injectable,
  MODULE_FILTER,
  createApp,
  createToken,
} from '../src'
import type { ExceptionFilter, ModuleMetadata } from '../src'
import { SYSTEM, expect, run, systemErrorCode, test } from './_test'

test.sequential('should expose only explicitly exported providers', async () => {
  expect.assertions(1)

  @Injectable()
  class ProjectService {
    value() {
      return 'project'
    }
  }

  @Module({
    providers: [ProjectService],
    exports: [ProjectService],
  })
  class ProjectModule {}

  @CommandMajor()
  class Major {
    constructor(private project: ProjectService) {}

    @Handler()
    run() {
      expect(this.project.value()).toBe('project')
    }
  }

  @Module({
    imports: [ProjectModule],
    commands: [Major],
  })
  class AppModule {}

  await run(AppModule, { argv: [] })
})

test.sequential('should reject access to private imported providers', async () => {
  @Injectable()
  class ProjectService {}

  @Module({ providers: [ProjectService] })
  class ProjectModule {}

  @CommandMajor()
  class Major {
    constructor(_project: ProjectService) {}

    @Handler()
    run() {}
  }

  @Module({
    imports: [ProjectModule],
    commands: [Major],
  })
  class AppModule {}

  await expect(run(AppModule, { argv: [] })).rejects.toMatchObject({
    code: systemErrorCode(SYSTEM.MISSING_PROVIDER),
  })
})

test.sequential(
  'should let imported commands resolve private providers from their owner module',
  async () => {
    expect.assertions(1)

    @Injectable()
    class ProjectService {}

    @CommandMajor()
    class Major {
      constructor(project: ProjectService) {
        expect(project).toBeInstanceOf(ProjectService)
      }

      @Handler()
      run() {}
    }

    @Module({
      commands: [Major],
      providers: [ProjectService],
    })
    class FeatureModule {}

    @Module({ imports: [FeatureModule] })
    class AppModule {}

    await run(AppModule, { argv: [] })
  },
)

test.sequential('should support explicit provider re-exports', async () => {
  expect.assertions(1)

  @Injectable()
  class ProjectService {}

  @Module({
    providers: [ProjectService],
    exports: [ProjectService],
  })
  class ProjectModule {}

  @Module({
    imports: [ProjectModule],
    exports: [ProjectService],
  })
  class FeatureModule {}

  @CommandMajor()
  class Major {
    constructor(project: ProjectService) {
      expect(project).toBeInstanceOf(ProjectService)
    }

    @Handler()
    run() {}
  }

  @Module({
    imports: [FeatureModule],
    commands: [Major],
  })
  class AppModule {}

  await run(AppModule, { argv: [] })
})

test.sequential(
  'should not expose providers transitively without a re-export',
  async () => {
    @Injectable()
    class ProjectService {}

    @Module({ providers: [ProjectService], exports: [ProjectService] })
    class ProjectModule {}

    @Module({ imports: [ProjectModule] })
    class BridgeModule {}

    @CommandMajor()
    class Major {
      constructor(_project: ProjectService) {}

      @Handler()
      run() {}
    }

    @Module({ imports: [BridgeModule], commands: [Major] })
    class AppModule {}

    await expect(run(AppModule, { argv: [] })).rejects.toMatchObject({
      code: systemErrorCode(SYSTEM.MISSING_PROVIDER),
    })
  },
)

test('should reject exports that are not visible to the module', () => {
  @Injectable()
  class ProjectService {}

  @Module({ exports: [ProjectService] })
  class AppModule {}

  expect(() => createApp(AppModule)).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_MODULE_EXPORT),
    }),
  )
})

test.sequential('should compile diamond imports only once', async () => {
  expect.assertions(1)
  let created = 0

  @Injectable()
  class SharedService {
    constructor() {
      created += 1
    }
  }

  @Module({
    providers: [SharedService],
    exports: [SharedService],
  })
  class SharedModule {}

  @Module({ imports: [SharedModule], exports: [SharedService] })
  class FirstModule {}

  @Module({ imports: [SharedModule], exports: [SharedService] })
  class SecondModule {}

  @CommandMajor()
  class Major {
    constructor(_shared: SharedService) {}

    @Handler()
    run() {
      expect(created).toBe(1)
    }
  }

  @Module({
    imports: [FirstModule, SecondModule],
    commands: [Major],
  })
  class AppModule {}

  await run(AppModule, { argv: [] })
})

test.sequential(
  'should isolate the same provider token between modules',
  async () => {
    expect.assertions(2)
    const INTERNAL = createToken<string>('INTERNAL')
    const FIRST = createToken<string>('FIRST')
    const SECOND = createToken<string>('SECOND')

    @Module({
      providers: [
        { provide: INTERNAL, useValue: 'first' },
        {
          provide: FIRST,
          inject: [INTERNAL],
          useFactory: (value: string) => value,
        },
      ],
      exports: [FIRST],
    })
    class FirstModule {}

    @Module({
      providers: [
        { provide: INTERNAL, useValue: 'second' },
        {
          provide: SECOND,
          inject: [INTERNAL],
          useFactory: (value: string) => value,
        },
      ],
      exports: [SECOND],
    })
    class SecondModule {}

    @CommandMajor()
    class Major {
      constructor(
        @Inject(FIRST) private first: string,
        @Inject(SECOND) private second: string,
      ) {}

      @Handler()
      run() {
        expect(this.first).toBe('first')
        expect(this.second).toBe('second')
      }
    }

    @Module({
      imports: [FirstModule, SecondModule],
      commands: [Major],
    })
    class AppModule {}

    await run(AppModule, { argv: [] })
  },
)

test.sequential(
  'should reject ambiguous imported providers only when resolved',
  async () => {
    const PROJECT = createToken<string>('PROJECT')

    @Module({
      providers: [{ provide: PROJECT, useValue: 'first' }],
      exports: [PROJECT],
    })
    class FirstModule {}

    @Module({
      providers: [{ provide: PROJECT, useValue: 'second' }],
      exports: [PROJECT],
    })
    class SecondModule {}

    @CommandMajor()
    class Major {
      constructor(@Inject(PROJECT) _project: string) {}

      @Handler()
      run() {}
    }

    @Module({
      imports: [FirstModule, SecondModule],
      commands: [Major],
    })
    class AppModule {}

    expect(() => createApp(AppModule)).not.toThrow()
    await expect(run(AppModule, { argv: [] })).rejects.toMatchObject({
      code: systemErrorCode(SYSTEM.DUPLICATE_PROVIDER),
      details: {
        module: 'AppModule',
        providers: ['FirstModule', 'SecondModule'],
        token: 'PROJECT',
      },
    })
  },
)

test.sequential(
  'should prefer a local provider over imported providers',
  async () => {
    expect.assertions(1)
    const PROJECT = createToken<string>('PROJECT')

    @Module({
      providers: [{ provide: PROJECT, useValue: 'imported' }],
      exports: [PROJECT],
    })
    class FeatureModule {}

    @CommandMajor()
    class Major {
      constructor(@Inject(PROJECT) private project: string) {}

      @Handler()
      run() {
        expect(this.project).toBe('local')
      }
    }

    @Module({
      imports: [FeatureModule],
      commands: [Major],
      providers: [{ provide: PROJECT, useValue: 'local' }],
    })
    class AppModule {}

    await run(AppModule, { argv: [] })
  },
)

test.sequential(
  'should resolve module error hooks from the selected command owner',
  async () => {
    const MODULE_NAME = createToken<string>('MODULE_NAME')
    const resolved: string[] = []

    @Command('first')
    class FirstCommand {
      @Handler()
      run() {
        throw new Error('first')
      }
    }

    @Catch()
    class FirstFilter implements ExceptionFilter {
      constructor(@Inject(MODULE_NAME) private readonly moduleName: string) {}

      catch() {
        resolved.push(this.moduleName)
      }
    }

    @Module({
      commands: [FirstCommand],
      providers: [
        { provide: MODULE_NAME, useValue: 'first' },
        { provide: MODULE_FILTER, useClass: FirstFilter },
      ],
    })
    class FirstModule {}

    @Command('second')
    class SecondCommand {
      @Handler()
      run() {
        throw new Error('second')
      }
    }

    @Catch()
    class SecondFilter implements ExceptionFilter {
      constructor(@Inject(MODULE_NAME) private readonly moduleName: string) {}

      catch() {
        resolved.push(this.moduleName)
      }
    }

    @Module({
      commands: [SecondCommand],
      providers: [
        { provide: MODULE_NAME, useValue: 'second' },
        { provide: MODULE_FILTER, useClass: SecondFilter },
      ],
    })
    class SecondModule {}

    @Module({
      imports: [FirstModule, SecondModule],
    })
    class AppModule {}

    await run(AppModule, { argv: ['first'] })
    await run(AppModule, { argv: ['second'] })
    expect(resolved).toEqual(['first', 'second'])
  },
)

test('should reject circular module imports', () => {
  const first: ModuleMetadata = {}
  const second: ModuleMetadata = { imports: [first] }
  first.imports = [second]

  @Module({ imports: [first] })
  class AppModule {}

  expect(() => createApp(AppModule)).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.CIRCULAR_MODULE_IMPORT),
    }),
  )
})
