import 'reflect-metadata/lite'
import { Args, ArrayValue, CommandMajor, Handler, Value } from '../src'
import type { Args as ArgsValue } from '../src'
import { normalizeNumberArrayArguments } from '../src/utils/filter'
import { createTestingApp } from '../src/subpath/testing'
import { expect, test } from 'vitest'
import { testModule } from './_test'

test.each([['--count', 'invalid'], ['--count', 'Infinity'], ['--count=-Infinity']])(
  'should reject non-finite number option %j',
  async (...argv) => {
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
  },
)

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

test('should not normalize number array arguments after the option delimiter', () => {
  expect(
    normalizeNumberArrayArguments(
      [{ aliases: [], name: 'port', type: [Number] }],
      ['--', '--port', '-1.5'],
    ),
  ).toEqual(['--', '--port', '-1.5'])
})

test.each([['--count', 'invalid'], ['--count', 'Infinity'], ['--count=-Infinity']])(
  'should reject non-finite number array option %j',
  async (...argv) => {
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
  },
)
