import * as func from '../src'
import {
  CommandMajor,
  Context,
  Module,
  Handler,
  Inject,
  Injectable,
  createToken,
} from '../src'
import { createTestingApp } from '../src/subpath/testing'
import { SYSTEM, expect, systemErrorCode, test, testModule } from './_test'

test.sequential(
  'should override providers only through the testing entry',
  async () => {
    expect.assertions(2)
    const PROJECT_NAME = createToken<{ value: string }>('PROJECT_NAME')
    let originalCreated = false

    @Injectable()
    class OriginalProjectName {
      value = 'original'

      constructor() {
        originalCreated = true
      }
    }

    @CommandMajor()
    class Major {
      constructor(@Inject(PROJECT_NAME) private projectName: { value: string }) {}

      @Handler()
      run() {
        expect(this.projectName.value).toBe('testing')
      }
    }

    @Module({
      commands: [Major],
      providers: [{ provide: PROJECT_NAME, useClass: OriginalProjectName }],
    })
    class AppModule {}

    const app = createTestingApp(AppModule, {
      overrides: [{ provide: PROJECT_NAME, useValue: { value: 'testing' } }],
    })
    await app.invoke()
    expect(originalCreated).toBe(false)
  },
)

test.sequential(
  'should isolate overrides between testing applications',
  async () => {
    const PROJECT_NAME = createToken<string>('PROJECT_NAME')

    @CommandMajor()
    class Major {
      constructor(@Inject(PROJECT_NAME) private projectName: string) {}

      @Handler()
      run() {
        return this.projectName
      }
    }

    @Module({
      commands: [Major],
      providers: [{ provide: PROJECT_NAME, useValue: 'original' }],
    })
    class AppModule {}

    const first = createTestingApp(AppModule, {
      overrides: [{ provide: PROJECT_NAME, useValue: 'first' }],
    })
    const second = createTestingApp(AppModule, {
      overrides: [{ provide: PROJECT_NAME, useValue: 'second' }],
    })
    const original = createTestingApp(AppModule)
    await expect(first.invoke()).resolves.toMatchObject({ result: 'first' })
    await expect(second.invoke()).resolves.toMatchObject({ result: 'second' })
    await expect(original.invoke()).resolves.toMatchObject({ result: 'original' })
  },
)

test.sequential(
  'should preserve provider ownership through re-exports',
  async () => {
    const INTERNAL_NAME = createToken<string>('INTERNAL_NAME')
    const PROJECT_NAME = createToken<string>('PROJECT_NAME')

    @Module({
      exports: [PROJECT_NAME],
      providers: [
        { provide: INTERNAL_NAME, useValue: 'private' },
        { provide: PROJECT_NAME, useValue: 'original' },
      ],
    })
    class FeatureModule {}

    @Module({ imports: [FeatureModule], exports: [PROJECT_NAME] })
    class BridgeModule {}

    @CommandMajor()
    class Major {
      constructor(@Inject(PROJECT_NAME) private projectName: string) {}

      @Handler()
      run() {
        return this.projectName
      }
    }

    @Module({ commands: [Major], imports: [BridgeModule] })
    class AppModule {}

    const app = createTestingApp(AppModule, {
      overrides: [
        {
          provide: PROJECT_NAME,
          inject: [INTERNAL_NAME],
          useFactory: (name: string) => `${name}:testing`,
        },
      ],
    })

    await expect(app.invoke()).resolves.toMatchObject({ result: 'private:testing' })
  },
)

test('should validate the original provider before applying an override', () => {
  const PROJECT_NAME = createToken<unknown>('PROJECT_NAME')
  class InvalidProjectName {}

  expect(() =>
    createTestingApp(
      testModule({
        providers: [{ provide: PROJECT_NAME, useClass: InvalidProjectName }],
      }),
      {
        overrides: [{ provide: PROJECT_NAME, useValue: 'testing' }],
      },
    ),
  ).toThrow(
    expect.objectContaining({ code: systemErrorCode(SYSTEM.INVALID_PROVIDER) }),
  )
})

test('should reject overrides for unregistered providers', () => {
  const PROJECT_NAME = createToken<string>('PROJECT_NAME')

  expect(() =>
    createTestingApp(testModule({}), {
      overrides: [{ provide: PROJECT_NAME, useValue: 'testing' }],
    }),
  ).toThrow(
    expect.objectContaining({ code: systemErrorCode(SYSTEM.MISSING_PROVIDER) }),
  )
})

test.sequential('should preserve provider visibility after override', async () => {
  const PROJECT_NAME = createToken<string>('PROJECT_NAME')

  @Module({
    providers: [{ provide: PROJECT_NAME, useValue: 'private' }],
  })
  class FeatureModule {}

  @CommandMajor()
  class Major {
    constructor(@Inject(PROJECT_NAME) _name: string) {}

    @Handler()
    run() {}
  }

  @Module({ imports: [FeatureModule], commands: [Major] })
  class AppModule {}

  const app = createTestingApp(AppModule, {
    overrides: [{ provide: PROJECT_NAME, useValue: 'testing' }],
  })
  const result = await app.invoke()
  expect(result.error).toMatchObject({
    code: systemErrorCode(SYSTEM.MISSING_PROVIDER),
  })
})

test('should reject token-only overrides for providers in multiple modules', () => {
  const PROJECT_NAME = createToken<string>('PROJECT_NAME')

  @Module({
    providers: [{ provide: PROJECT_NAME, useValue: 'first' }],
  })
  class FirstModule {}

  @Module({
    providers: [{ provide: PROJECT_NAME, useValue: 'second' }],
  })
  class SecondModule {}

  @Module({ imports: [FirstModule, SecondModule] })
  class AppModule {}

  expect(() =>
    createTestingApp(AppModule, {
      overrides: [{ provide: PROJECT_NAME, useValue: 'testing' }],
    }),
  ).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.DUPLICATE_PROVIDER),
      details: {
        modules: ['FirstModule', 'SecondModule'],
        token: 'PROJECT_NAME',
      },
    }),
  )
})

test.sequential('should scope overrides to a module', async () => {
  expect.assertions(1)
  const PROJECT_NAME = createToken<string>('PROJECT_NAME')

  @CommandMajor()
  class Major {
    constructor(@Inject(PROJECT_NAME) private projectName: string) {}

    @Handler()
    run() {
      expect(this.projectName).toBe('testing')
    }
  }

  @Module({
    commands: [Major],
    providers: [{ provide: PROJECT_NAME, useValue: 'first' }],
  })
  class FirstModule {}

  @Module({
    providers: [{ provide: PROJECT_NAME, useValue: 'second' }],
  })
  class SecondModule {}

  @Module({ imports: [FirstModule, SecondModule] })
  class AppModule {}

  const app = createTestingApp(AppModule, {
    overrides: [
      {
        module: FirstModule,
        provider: { provide: PROJECT_NAME, useValue: 'testing' },
      },
    ],
  })
  await app.invoke()
})

test('should keep testing helpers out of the main entry', () => {
  expect('createTestingApp' in func).toBe(false)
})

test.sequential(
  'should return an isolated exit code for every invocation',
  async () => {
    @CommandMajor()
    class Major {
      constructor(private context: Context) {}

      @Handler()
      run() {
        this.context.exitCode = 2
      }
    }

    const originalExitCode = process.exitCode
    const app = createTestingApp(testModule({ commands: [Major] }))
    const result = await app.invoke()
    expect(result.exitCode).toBe(2)
    expect(result.error).toBeUndefined()
    expect(process.exitCode).toBe(originalExitCode)
  },
)

test.sequential(
  'should return one for a default-routed invocation error',
  async () => {
    @CommandMajor()
    class Major {
      @Handler()
      run() {
        throw new Error('boom')
      }
    }

    const result = await createTestingApp(testModule({ commands: [Major] })).invoke()
    expect(result.exitCode).toBe(1)
    expect(result.error).toBeUndefined()
    expect(result.stderr).toBe('boom\n')
  },
)

test.sequential(
  'should return handled failures without an escaped error',
  async () => {
    @CommandMajor()
    class Major {
      @Handler()
      run() {
        throw new Error('handled')
      }
    }

    @Module({ commands: [Major] })
    class AppModule implements func.OnError {
      onError() {}
    }

    const result = await createTestingApp(AppModule).invoke()
    expect(result.exitCode).toBe(1)
    expect(result.error).toBeUndefined()
    expect(result.stderr).toBe('')
  },
)

test.sequential(
  'should provide isolated stdin and cwd through context',
  async () => {
    const signal = new AbortController().signal

    @CommandMajor()
    class Major {
      constructor(private context: Context) {}

      @Handler()
      async run() {
        expect(this.context.signal).toBe(signal)
        const chunks: Buffer[] = []
        for await (const chunk of this.context.io.stdin) {
          const value: unknown = chunk
          if (typeof value !== 'string' && !(value instanceof Uint8Array)) {
            throw new TypeError('stdin emitted an unsupported chunk type')
          }
          chunks.push(Buffer.from(value))
        }
        this.context.io.stdout.write(
          `${this.context.cwd}:${Buffer.concat(chunks).toString('utf8')}`,
        )
      }
    }

    const result = await createTestingApp(testModule({ commands: [Major] })).invoke(
      [],
      {
        cwd: '/workspace',
        signal,
        stdin: 'yes',
      },
    )

    expect(result.stdout).toBe('/workspace:yes')
    expect(result.stderr).toBe('')
  },
)

test('should isolate concurrent invocations on the same testing app', async () => {
  let activeInvocations = 0
  let peakInvocations = 0

  @Injectable()
  class InvocationState {}

  const contexts = new Map<string, Context>()
  const states = new Map<string, InvocationState>()

  @CommandMajor()
  class Major {
    constructor(
      private context: Context,
      private state: InvocationState,
    ) {}

    @Handler()
    async run() {
      const name = this.context.env.INVOCATION
      if (!name) throw new Error('Missing invocation name.')
      contexts.set(name, this.context)
      states.set(name, this.state)
      activeInvocations += 1
      peakInvocations = Math.max(peakInvocations, activeInvocations)
      await new Promise<void>(resolve => setImmediate(resolve))
      activeInvocations -= 1
      const chunks: Buffer[] = []
      for await (const chunk of this.context.io.stdin) {
        const value: unknown = chunk
        if (typeof value !== 'string' && !(value instanceof Uint8Array)) {
          throw new TypeError('stdin emitted an unsupported chunk type')
        }
        chunks.push(Buffer.from(value))
      }
      this.context.exitCode = name === 'first' ? 1 : 2
      this.context.io.stdout.write(
        `${name}:${this.context.cwd}:${Buffer.concat(chunks).toString('utf8')}`,
      )
    }
  }

  const app = createTestingApp(
    testModule({ commands: [Major], providers: [InvocationState] }),
  )
  const [first, second] = await Promise.all([
    app.invoke([], {
      cwd: '/first',
      env: { INVOCATION: 'first' },
      stdin: 'alpha',
    }),
    app.invoke([], {
      cwd: '/second',
      env: { INVOCATION: 'second' },
      stdin: 'beta',
    }),
  ])

  expect(peakInvocations).toBe(2)
  expect(first).toMatchObject({
    error: undefined,
    exitCode: 1,
    stderr: '',
    stdout: 'first:/first:alpha',
  })
  expect(second).toMatchObject({
    error: undefined,
    exitCode: 2,
    stderr: '',
    stdout: 'second:/second:beta',
  })
  expect(contexts.get('first')).not.toBe(contexts.get('second'))
  expect(states.get('first')).not.toBe(states.get('second'))
})
