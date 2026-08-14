import 'reflect-metadata/lite'
import {
  Args,
  ArrayValue,
  CommandMajor,
  Flag,
  Handler,
  Value,
  ValueValidate,
  createApp,
} from '../src'
import type { Args as ArgsValue } from '../src'
import { SYSTEM, expect, systemErrorCode, test, testModule } from './_test'

test.sequential(
  'should run with multiple field options together',
  async ({ runContainer }) => {
    expect.assertions(8)

    @CommandMajor()
    class Major {
      @Flag()
      verbose = false

      @Value()
      config: string = 'func.config.ts'

      @Value()
      port: number = 3000

      @ArrayValue()
      include: string[] = []

      @Handler()
      run(@Args() arg: ArgsValue) {
        expect(this.verbose).toBe(true)
        expect(this.config).toBe('func.config.ts')
        expect(this.port).toBe(4000)
        expect(this.include).toEqual(['src', 'tests'])
        expect(arg.options.verbose).toBe(true)
        expect(arg.options.config).toBe('func.config.ts')
        expect(arg.options.port).toBe(4000)
        expect(arg.options.include).toEqual(['src', 'tests'])
      }
    }

    await runContainer(
      [
        '',
        '',
        '--verbose',
        '--port',
        '4000',
        '--include',
        'src',
        '--include',
        'tests',
      ],
      [Major],
    )
  },
)

test.sequential(
  'should run with scalar and boolean field options together',
  async ({ runContainer }) => {
    expect.assertions(4)

    @CommandMajor()
    class Major {
      @Flag({ name: 'dry-run', alias: 'd' })
      dryRun = false

      @Value()
      retry: number = 0

      @Value()
      target: string = 'local'

      @Handler()
      run(@Args() arg: ArgsValue) {
        expect(this.target).toBe('production')
        expect(arg.options.target).toBe('production')
        expect(arg.options['dry-run']).toBe(true)
        expect(arg.options.retry).toBe(2)
      }
    }

    await runContainer(
      ['', '', '--target', 'production', '-d', '--retry', '2'],
      [Major],
    )
  },
)

test.sequential(
  'should run with flags, values, and arrays together',
  async ({ runContainer }) => {
    expect.assertions(5)

    @CommandMajor()
    class Major {
      @Flag({ alias: 'f' })
      force = false

      @Flag({ name: 'verbose', aliases: ['v', 'd'] })
      debug = false

      @Value({ name: 'mode', aliases: ['m'] })
      runMode: string = 'dev'

      @ArrayValue({ name: 'tag', aliases: ['t'] })
      tags: string[] = []

      @Handler()
      run(@Args() arg: ArgsValue) {
        expect(this.debug).toBe(true)
        expect(this.runMode).toBe('release')
        expect(this.tags).toEqual(['stable', 'canary'])
        expect(arg.options.force).toBe(true)
        expect(arg.options).toEqual(
          expect.objectContaining({
            verbose: true,
            mode: 'release',
            tag: ['stable', 'canary'],
          }),
        )
      }
    }

    await runContainer(
      ['', '', '-d', '-m', 'release', '-t', 'stable', '-t', 'canary', '-f'],
      [Major],
    )
  },
)

test.sequential(
  'should support option and property names matching prototype keys',
  async ({ runContainer }) => {
    expect.assertions(13)

    @CommandMajor()
    class Major {
      @Handler()
      run(@Args() arg: ArgsValue) {
        expect(Object.getPrototypeOf(arg.options)).toBeNull()
        expect(Object.isFrozen(arg.options)).toBe(true)
        expect(Object.prototype.hasOwnProperty.call(this, '__proto__')).toBe(true)
        expect(Object.prototype.hasOwnProperty.call(this, 'constructor')).toBe(true)
        expect(Object.prototype.hasOwnProperty.call(this, 'toString')).toBe(true)
        expect(Reflect.get(this, '__proto__')).toBe('safe-prototype')
        expect(Reflect.get(this, 'constructor')).toBe('safe-constructor')
        expect(Reflect.get(this, 'toString')).toBeUndefined()
        expect(arg.options['__proto__']).toBe('safe-prototype')
        expect(arg.options.constructor).toBe('safe-constructor')
        expect(arg.options.toString).toBeUndefined()
      }
    }

    Value({ type: String })(Major.prototype, '__proto__')
    ValueValidate((value, options) => {
      expect(value).toBe('safe-prototype')
      expect(Object.getPrototypeOf(options)).toBeNull()
    })(Major.prototype, '__proto__')
    Value({ type: String })(Major.prototype, 'constructor')
    Value({ type: String })(Major.prototype, 'toString')

    await runContainer(
      ['', '', '--__proto__', 'safe-prototype', '--constructor', 'safe-constructor'],
      [Major],
    )
  },
)

test('should throw when multiple decorators use the same property option name', () => {
  @CommandMajor()
  class Major {
    @Flag()
    @Value()
    target: string = 'local'

    @Handler()
    run() {}
  }

  expect(() => createApp(testModule({ commands: [Major] }))).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.DUPLICATE_OPTION_TOKEN),
      details: expect.objectContaining({ token: '--target' }),
    }),
  )
})

test('should throw when field options duplicate names or aliases', () => {
  @CommandMajor()
  class DuplicateName {
    @Flag({ name: 'debug' })
    first = false

    @Value({ name: 'debug' })
    second: string = ''

    @Handler()
    run() {}
  }

  @CommandMajor()
  class DuplicateAlias {
    @Flag({ aliases: ['d', 'x'] })
    first = false

    @Value({ aliases: ['v', 'x'] })
    second: string = ''

    @Handler()
    run() {}
  }

  expect(() => createApp(testModule({ commands: [DuplicateName] }))).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.DUPLICATE_OPTION_TOKEN),
      details: expect.objectContaining({ token: '--debug' }),
    }),
  )
  expect(() => createApp(testModule({ commands: [DuplicateAlias] }))).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.DUPLICATE_OPTION_TOKEN),
      details: expect.objectContaining({ token: '-x' }),
    }),
  )
})

test('should throw when field options conflict with handler flags', () => {
  @CommandMajor()
  class DuplicateHandlerFlag {
    @Flag({ name: 'guide', aliases: ['g', 'h'] })
    helpEnabled = false

    @Handler({ flag: 'help', aliases: ['?', 'h'] })
    help() {}

    @Handler()
    run() {}
  }

  expect(() => createApp(testModule({ commands: [DuplicateHandlerFlag] }))).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.DUPLICATE_OPTION_TOKEN),
      details: expect.objectContaining({ token: '-h' }),
    }),
  )
})

test('should reserve generated negative flag tokens', () => {
  @CommandMajor()
  class Major {
    @Flag({ name: 'cache', negatable: true })
    cache = true

    @Flag({ name: 'no-cache' })
    noCache = false

    @Handler()
    run() {}
  }

  expect(() => createApp(testModule({ commands: [Major] }))).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.DUPLICATE_OPTION_TOKEN),
      details: expect.objectContaining({ token: '--no-cache' }),
    }),
  )
})
