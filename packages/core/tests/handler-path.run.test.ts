import {
  Args,
  Command,
  FuncArgs,
  Handler,
} from '../src'
import { expect, random, test } from './_test'

test.sequential('should select a handler by path before default handler', async ({
  runContainer,
}) => {
  expect.assertions(3)
  const name = random()

  @Command({ name })
  class ConfigCommand {
    @Handler({ path: ['get'] })
    get(@Args() args: FuncArgs) {
      expect(args.inputs).toEqual(['registry'])
      expect(args.path).toEqual(['get'])
      expect(args.handler?.methodName).toBe('get')
    }

    @Handler()
    run() {
      throw new Error('default handler should not run')
    }
  }

  await runContainer(['', '', name, 'get', 'registry'], [ConfigCommand])
})

test.sequential('should support multi-segment handler paths', async ({ runContainer }) => {
  expect.assertions(1)
  const name = random()

  @Command({ name })
  class GitCommand {
    @Handler({ path: ['remote', 'add'] })
    remoteAdd(@Args() args: FuncArgs) {
      expect(args.inputs).toEqual(['origin'])
    }

    @Handler()
    run() {
      throw new Error('default handler should not run')
    }
  }

  await runContainer(['', '', name, 'remote', 'add', 'origin'], [GitCommand])
})

test.sequential('should select flag handlers after path handlers', async ({ runContainer }) => {
  let selected = ''
  const name = random()

  @Command({ name })
  class ConfigCommand {
    @Handler({ path: ['help'] })
    pathHelp() {
      selected = 'path'
    }

    @Handler({ flag: 'help', alias: 'h' })
    flagHelp() {
      selected = 'flag'
    }
  }

  await runContainer(['', '', name, 'help', '-h'], [ConfigCommand])

  expect(selected).toBe('path')
})
