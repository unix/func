import 'reflect-metadata'
import {
  Args,
  ArrayValue,
  CommandMajor,
  Container,
  F_SYSTEM,
  Flag,
  FuncArgs,
  Handler,
  SubOptions,
  Value,
} from '../src'
import { expect, test } from './_test'

test.sequential('should run with multiple field options together', async ({
  runContainer,
}) => {
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
    run(@Args() arg: FuncArgs) {
      expect(this.verbose).toBe(true)
      expect(this.config).toBe('func.config.ts')
      expect(this.port).toBe(4000)
      expect(this.include).toEqual(['src', 'tests'])
      expect(arg.option.verbose).toBe(true)
      expect(arg.option.config).toBe('func.config.ts')
      expect(arg.option.port).toBe(4000)
      expect(arg.option.include).toEqual(['src', 'tests'])
    }
  }

  await runContainer(
    ['', '', '--verbose', '--port', '4000', '--include', 'src', '--include', 'tests'],
    [Major],
  )
})

test.sequential('should run with values and sub-options together', async ({
  runContainer,
}) => {
  expect.assertions(4)

  @CommandMajor()
  @SubOptions([
    { name: 'dry-run', alias: 'd' },
    { name: 'retry', type: Number },
  ])
  class Major {
    @Value()
    target: string = 'local'

    @Handler()
    run(@Args() arg: FuncArgs) {
      expect(this.target).toBe('production')
      expect(arg.option.target).toBe('production')
      expect(arg.option['dry-run']).toBe(true)
      expect(arg.option.retry).toBe(2)
    }
  }

  await runContainer(['', '', '--target', 'production', '-d', '--retry', '2'], [Major])
})

test.sequential('should run with flags, values, arrays, and sub-options together', async ({
  runContainer,
}) => {
  expect.assertions(5)

  @CommandMajor()
  @SubOptions([{ name: 'force', alias: 'f' }])
  class Major {
    @Flag({ name: 'verbose', alias: 'v' })
    debug = false

    @Value({ name: 'mode' })
    runMode: string = 'dev'

    @ArrayValue({ name: 'tag' })
    tags: string[] = []

    @Handler()
    run(@Args() arg: FuncArgs) {
      expect(this.debug).toBe(true)
      expect(this.runMode).toBe('release')
      expect(this.tags).toEqual(['stable', 'canary'])
      expect(arg.option.force).toBe(true)
      expect(arg.option).toEqual(
        expect.objectContaining({
          verbose: true,
          mode: 'release',
          tag: ['stable', 'canary'],
        }),
      )
    }
  }

  await runContainer(
    ['', '', '-v', '--mode', 'release', '--tag', 'stable', '--tag', 'canary', '-f'],
    [Major],
  )
})

test('should throw when multiple decorators use the same property option name', () => {
  @CommandMajor()
  class Major {
    @Flag()
    @Value()
    target: string = 'local'

    @Handler()
    run() {}
  }

  expect(() => new Container([Major])).toThrow(
    expect.objectContaining({
      code: F_SYSTEM.DUPLICATE_HANDLER,
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
    @Flag({ alias: 'd' })
    first = false

    @Value({ alias: 'd' })
    second: string = ''

    @Handler()
    run() {}
  }

  expect(() => new Container([DuplicateName])).toThrow(
    expect.objectContaining({
      code: F_SYSTEM.DUPLICATE_HANDLER,
      details: expect.objectContaining({ token: '--debug' }),
    }),
  )
  expect(() => new Container([DuplicateAlias])).toThrow(
    expect.objectContaining({
      code: F_SYSTEM.DUPLICATE_HANDLER,
      details: expect.objectContaining({ token: '-d' }),
    }),
  )
})

test('should throw when field options conflict with sub-options or handler flags', () => {
  @CommandMajor()
  @SubOptions([{ name: 'config', alias: 'c' }])
  class DuplicateSubOption {
    @Value({ name: 'config' })
    config: string = ''

    @Handler()
    run() {}
  }

  @CommandMajor()
  class DuplicateHandlerFlag {
    @Flag({ name: 'help', alias: 'h' })
    helpEnabled = false

    @Handler({ flag: 'help' })
    help() {}

    @Handler()
    run() {}
  }

  expect(() => new Container([DuplicateSubOption])).toThrow(
    expect.objectContaining({
      code: F_SYSTEM.DUPLICATE_HANDLER,
      details: expect.objectContaining({ token: '--config' }),
    }),
  )
  expect(() => new Container([DuplicateHandlerFlag])).toThrow(
    expect.objectContaining({
      code: F_SYSTEM.DUPLICATE_HANDLER,
      details: expect.objectContaining({ token: '--help' }),
    }),
  )
})
