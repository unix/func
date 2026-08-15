import 'reflect-metadata/lite'
import { Args, CommandMajor, Flag, Handler } from '../src'
import type { Args as ArgsValue } from '../src'
import { createTestingApp } from '../src/subpath/testing'
import { expect, test, testModule } from './_test'

test('should parse both forms of a negatable flag into one logical option', async () => {
  const values: Array<{
    color: boolean
    options: ArgsValue['options']
  }> = []

  @CommandMajor()
  class Major {
    @Flag({ alias: 'c', aliases: ['k', 'c'], negatable: true })
    color = true

    @Handler()
    run(@Args() args: ArgsValue) {
      values.push({ color: this.color, options: args.options })
    }
  }

  const app = createTestingApp(testModule({ commands: [Major] }))
  expect((await app.invoke()).exitCode).toBe(0)
  expect(values.at(-1)).toEqual({ color: true, options: { color: true } })
  expect((await app.invoke(['--no-color'])).exitCode).toBe(0)
  expect(values.at(-1)).toEqual({ color: false, options: { color: false } })
  expect((await app.invoke(['--color'])).exitCode).toBe(0)
  expect(values.at(-1)).toEqual({ color: true, options: { color: true } })
  expect((await app.invoke(['--color', '--no-color'])).exitCode).toBe(0)
  expect(values.at(-1)).toEqual({ color: false, options: { color: false } })
  expect((await app.invoke(['--no-color', '-c'])).exitCode).toBe(0)
  expect(values.at(-1)).toEqual({ color: true, options: { color: true } })
  expect((await app.invoke(['-k', '--no-color'])).exitCode).toBe(0)
  expect(values.at(-1)).toEqual({ color: false, options: { color: false } })
})

test('should reject the negative form of a regular flag', async () => {
  @CommandMajor()
  class Major {
    @Flag()
    color = false

    @Handler()
    run() {}
  }

  const result = await createTestingApp(testModule({ commands: [Major] })).invoke([
    '--no-color',
  ])

  expect(result).toMatchObject({
    error: undefined,
    exitCode: 1,
    stderr: 'Unknown option: --no-color.\n',
  })
})

test('should reject attached boolean values', async () => {
  @CommandMajor()
  class Major {
    @Flag()
    color = false

    @Handler()
    run() {}
  }

  const result = await createTestingApp(testModule({ commands: [Major] })).invoke([
    '--color=false',
  ])

  expect(result).toMatchObject({
    error: undefined,
    exitCode: 1,
    stderr: 'Option "--color" does not accept a value.\n',
  })
})

test('should parse known short flag groups and preserve unknown groups', async () => {
  let values: [boolean, boolean] | undefined

  @CommandMajor()
  class Major {
    @Flag({ alias: 'f' })
    force = false

    @Flag({ alias: 'v' })
    verbose = false

    @Handler()
    run() {
      values = [this.force, this.verbose]
    }
  }

  const app = createTestingApp(testModule({ commands: [Major] }))
  expect((await app.invoke(['-vf'])).exitCode).toBe(0)
  expect(values).toEqual([true, true])
  expect(await app.invoke(['-vx'])).toMatchObject({
    error: undefined,
    exitCode: 1,
    stderr: 'Unknown option: -vx.\n',
  })
})
