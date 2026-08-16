import { Args, Command, CommandMissing, Handler } from '../src'
import type { Args as ArgsValue } from '../src'
import { createTestingApp } from '../src/subpath/testing'
import { expect, test } from 'vitest'
import { run, testModule } from './_test'

test('should report an unknown command as a failed invocation', async () => {
  @Command('build')
  class BuildCommand {
    @Handler()
    run() {}
  }

  const result = await createTestingApp(
    testModule({ commands: [BuildCommand] }),
  ).invoke(['bulid', '--force'])

  expect(result).toMatchObject({
    error: undefined,
    exitCode: 1,
    stderr: 'Unknown command "bulid".\n',
  })
})

test('should preserve a registered missing command handler', async () => {
  let inputs: readonly string[] = []

  @CommandMissing()
  class MissingCommand {
    @Handler()
    run(@Args() args: ArgsValue) {
      inputs = args.inputs
    }
  }

  const result = await createTestingApp(
    testModule({ commands: [MissingCommand] }),
  ).invoke(['unknown', 'resource'])

  expect(result.exitCode).toBe(0)
  expect(inputs).toEqual(['unknown', 'resource'])
})

test('should preserve positional inputs after a matched command', async () => {
  let inputs: readonly string[] = []

  @Command('deploy')
  class DeployCommand {
    @Handler()
    run(@Args() args: ArgsValue) {
      inputs = args.inputs
    }
  }

  const invocation = await run(testModule({ commands: [DeployCommand] }), {
    argv: ['deploy', 'production'],
  })

  expect(invocation.exitCode).toBe(0)
  expect(inputs).toEqual(['production'])
})
