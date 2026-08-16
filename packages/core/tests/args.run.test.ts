import {
  Args,
  ArrayString,
  Command,
  Context,
  Ctx,
  Flag,
  Handler,
  Inject,
} from '../src'
import type { Args as ArgsValue } from '../src'
import { SYSTEM, expect, random, systemErrorCode, test } from './_test'

test.sequential(
  'should inject normalized args by token',
  async ({ runContainer }) => {
    expect.assertions(8)
    const name = random()

    @Command(name)
    class BuildCommand {
      @Flag()
      verbose = false

      @Handler()
      run(@Args() args: ArgsValue) {
        expect(args.inputs).toEqual(['src'])
        expect(args.invokedPath).toEqual([name])
        expect(args.options.verbose).toBe(true)
        expect(args.path).toEqual([name])
        expect(args.raw).toEqual([name, 'src', '--verbose'])
        expect(Object.isFrozen(args)).toBe(true)
        expect(Object.isFrozen(args.raw)).toBe(true)
        expect(Object.isFrozen(args.options)).toBe(true)
      }
    }

    await runContainer(['', '', name, 'src', '--verbose'], [BuildCommand])
  },
)

test.sequential(
  'should inject context by class token in constructors',
  async ({ runContainer }) => {
    expect.assertions(11)
    const name = random()

    @Command({ alias: 'b', aliases: ['build', 'b'], path: name })
    class BuildCommand {
      @ArrayString({ aliases: ['i'] })
      include: string[] = []

      constructor(private context: Context) {}

      @Handler()
      run() {
        const command = this.context.commands.find(item => item.path[0] === name)
        if (!command) throw new Error(`Command "${name}" is not registered.`)
        expect(this.context.command?.path).toEqual([name])
        expect(this.context.commands.map(item => item.path)).toContainEqual([name])
        expect(this.context.command).toBe(command)
        expect(Object.isFrozen(this.context.commands)).toBe(true)
        expect(Object.isFrozen(command)).toBe(true)
        expect(command.aliases).toEqual(['b', 'build'])
        expect(Object.isFrozen(command.aliases)).toBe(true)
        expect(Object.isFrozen(command.path)).toBe(true)
        expect(Object.isFrozen(command.fieldOptions ?? {})).toBe(true)
        expect(Object.isFrozen(command.fieldOptions?.[0].type ?? {})).toBe(true)
        expect(command.fieldOptions?.[0]).not.toHaveProperty('validators')
      }
    }

    await runContainer(['', '', 'build'], [BuildCommand])
  },
)

test.sequential(
  'should inject context into decorated method parameters',
  async ({ runContainer }) => {
    expect.assertions(1)

    @Command('build')
    class BuildCommand {
      @Handler()
      run(@Inject(Context) context: Context) {
        expect(context.command?.path).toEqual(['build'])
      }
    }

    await runContainer(['', '', 'build'], [BuildCommand])
  },
)

test.sequential('should inject context by Ctx alias', async ({ runContainer }) => {
  expect.assertions(1)

  @Command('build')
  class BuildCommand {
    @Handler()
    run(@Ctx() context: Context) {
      expect(context.command?.path).toEqual(['build'])
    }
  }

  await runContainer(['', '', 'build'], [BuildCommand])
})

test.sequential(
  'should reject undecorated parameters as missing providers',
  async ({ runContainer }) => {
    expect.assertions(1)
    const name = random()

    @Command(name)
    class BuildCommand {
      @Handler()
      run(_args: ArgsValue) {}
    }

    await expect(
      runContainer(['', '', name, 'src'], [BuildCommand]),
    ).rejects.toMatchObject({
      code: systemErrorCode(SYSTEM.MISSING_PROVIDER),
      details: { token: 'Object' },
    })
  },
)
