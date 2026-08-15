import 'reflect-metadata/lite'
import { Args, ArrayValue, Command, CommandMajor, Handler, Value } from '../src'
import type { Args as ArgsValue } from '../src'
import { createTestingApp } from '../src/subpath/testing'
import { expect, test } from 'vitest'
import { testModule } from './_test'

test.each([
  ['--count', 'invalid'],
  ['--count', 'Infinity'],
  ['--count', '-Infinity'],
  ['--count=-Infinity'],
  ['--count='],
])('should reject non-finite number option %j', async (...argv) => {
  let called = false

  @CommandMajor()
  class Major {
    @Value()
    count: number = 0

    @Handler()
    run() {
      called = true
    }
  }

  const result = await createTestingApp(testModule({ commands: [Major] })).invoke(
    argv,
  )

  expect(result).toMatchObject({
    error: undefined,
    exitCode: 1,
    stderr: 'Option "--count" must be a finite number.\n',
  })
  expect(called).toBe(false)
})

test('should preserve finite number parsing', async () => {
  let options: ArgsValue['options'] | undefined

  @CommandMajor()
  class Major {
    @Value()
    count: number = 0

    @Handler()
    run(@Args() args: ArgsValue) {
      options = args.options
    }
  }

  const result = await createTestingApp(testModule({ commands: [Major] })).invoke([
    '--count',
    '-1.5',
  ])

  expect(result.exitCode).toBe(0)
  expect(options?.count).toBe(-1.5)
})

test.each([
  [['--count', '-1e3'], -1000],
  [['--count=0x10'], 16],
] as const)(
  'should parse consistent finite number syntax %j',
  async (argv, value) => {
    let count: number | undefined

    @CommandMajor()
    class Major {
      @Value()
      count: number = 0

      @Handler()
      run() {
        count = this.count
      }
    }

    const result = await createTestingApp(testModule({ commands: [Major] })).invoke(
      argv,
    )

    expect(result.exitCode).toBe(0)
    expect(count).toBe(value)
  },
)

test('should collect finite number arrays including negative alias values', async () => {
  let options: ArgsValue['options'] | undefined

  @CommandMajor()
  class Major {
    @ArrayValue({ aliases: ['p'], type: Number })
    port: number[] = []

    @Handler()
    run(@Args() args: ArgsValue) {
      options = args.options
    }
  }

  const result = await createTestingApp(testModule({ commands: [Major] })).invoke([
    '--port',
    '3000',
    '-p',
    '-1.5',
  ])

  expect(result.exitCode).toBe(0)
  expect(options?.port).toEqual([3000, -1.5])
})

test('should treat arguments after the option delimiter as inputs', async () => {
  let inputs: readonly string[] | undefined
  let port: number[] | undefined

  @Command('build')
  class Build {
    @ArrayValue({ type: Number })
    port: number[] = []

    @Handler()
    run(@Args() args: ArgsValue) {
      inputs = args.inputs
      port = this.port
    }
  }

  const result = await createTestingApp(testModule({ commands: [Build] })).invoke([
    'build',
    '--',
    '--port',
    '-1.5',
  ])

  expect(result.exitCode).toBe(0)
  expect(inputs).toEqual(['--port', '-1.5'])
  expect(port).toEqual([])
})

test.each([
  ['--count', 'invalid'],
  ['--count', 'Infinity'],
  ['--count', '-Infinity'],
  ['--count=-Infinity'],
  ['--count='],
])('should reject non-finite number array option %j', async (...argv) => {
  let called = false

  @CommandMajor()
  class Major {
    @ArrayValue({ type: Number })
    count: number[] = []

    @Handler()
    run() {
      called = true
    }
  }

  const result = await createTestingApp(testModule({ commands: [Major] })).invoke(
    argv,
  )

  expect(result).toMatchObject({
    error: undefined,
    exitCode: 1,
    stderr: 'Option "--count" must be a finite number.\n',
  })
  expect(called).toBe(false)
})
