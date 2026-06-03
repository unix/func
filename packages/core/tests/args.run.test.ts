import {
  Args,
  Command,
  FuncArgs,
  Flag,
  Handler,
  Regs,
  CommandRegistry,
} from '../src'
import { expect, random, test } from './_test'

test.sequential('should inject normalized args by token', async ({ runContainer }) => {
  expect.assertions(4)
  const name = random()

  @Command({ name })
  class BuildCommand {
    @Flag()
    verbose = false

    @Handler()
    run(@Args() args: FuncArgs) {
      expect(args.inputs).toEqual(['src'])
      expect(args.option.verbose).toBe(true)
      expect(args.command?.name).toBe(name)
      expect(args.handler?.methodName).toBe('run')
    }
  }

  await runContainer(['', '', name, 'src', '--verbose'], [BuildCommand])
})

test.sequential('should inject registered command metadata by token', async ({ runContainer }) => {
  expect.assertions(2)
  const name = random()

  @Command({ name })
  class BuildCommand {
    @Handler()
    run(@Regs() regs: CommandRegistry) {
      expect(regs.commands.map(item => item.name)).toContain(name)
      expect(regs.commands[0].handlers?.[0].methodName).toBe('run')
    }
  }

  await runContainer(['', '', name], [BuildCommand])
})

test.sequential('should not inject undecorated parameters', async ({ runContainer }) => {
  expect.assertions(1)
  const name = random()

  @Command({ name })
  class BuildCommand {
    @Handler()
    run(args: FuncArgs) {
      expect(args).toBeUndefined()
    }
  }

  await runContainer(['', '', name, 'src'], [BuildCommand])
})
