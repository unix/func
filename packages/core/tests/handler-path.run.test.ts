import { Args, Command, CommandMajor, CommandMissing, Handler } from '../src'
import type { Args as ArgsValue } from '../src'
import { Writable } from 'node:stream'
import { expect, random, run, test, testModule } from './_test'

test.sequential(
  'should select a handler by path before default handler',
  async ({ runContainer }) => {
    expect.assertions(4)
    const name = random()

    @Command(name)
    class ConfigCommand {
      @Handler('get')
      get(@Args() args: ArgsValue) {
        expect(args.inputs).toEqual(['registry'])
        expect(args.invokedPath).toEqual([name, 'get'])
        expect(args.path).toEqual([name, 'get'])
        expect(args.raw).toEqual([name, 'get', 'registry'])
      }

      @Handler()
      run() {
        throw new Error('default handler should not run')
      }
    }

    await runContainer(['', '', name, 'get', 'registry'], [ConfigCommand])
  },
)

test.sequential(
  'should support multi-segment handler paths',
  async ({ runContainer }) => {
    expect.assertions(1)
    const name = random()

    @Command(name)
    class GitCommand {
      @Handler(['remote', 'add'])
      remoteAdd(@Args() args: ArgsValue) {
        expect(args.inputs).toEqual(['origin'])
      }

      @Handler()
      run() {
        throw new Error('default handler should not run')
      }
    }

    await runContainer(['', '', name, 'remote', 'add', 'origin'], [GitCommand])
  },
)

test.sequential(
  'should scope flag handlers to the exact command prefix',
  async ({ runContainer }) => {
    let selected = ''
    const name = random()

    @Command(name)
    class ConfigCommand {
      @Handler('help')
      pathHelp() {
        selected = 'path'
      }

      @Handler({ flag: 'help', aliases: ['h', '?'] })
      flagHelp() {
        selected = 'flag'
      }
    }

    await runContainer(['', '', name, 'help'], [ConfigCommand])
    expect(selected).toBe('path')
    await runContainer(['', '', name, '-?'], [ConfigCommand])
    expect(selected).toBe('flag')
  },
)

test.sequential('should scope major flags to the root endpoint', async () => {
  let selected = ''

  @CommandMajor()
  class Major {
    @Handler('config')
    config() {
      selected = 'config'
    }

    @Handler({ flag: 'help' })
    help() {
      selected = 'help'
    }
  }

  const output = capturedOutput()
  const invocation = await run(testModule({ commands: [Major] }), {
    argv: ['config', '--help'],
    stderr: output.stream,
  })
  expect(invocation.exitCode).toBe(1)
  expect(output.text()).toBe('Unknown option: --help.\n')
  expect(selected).toBe('')
})

test.sequential('should scope missing flags to the root endpoint', async () => {
  let selected = ''

  @CommandMissing()
  class Missing {
    @Handler('search')
    search() {
      selected = 'search'
    }

    @Handler({ flag: 'help' })
    help() {
      selected = 'help'
    }
  }

  const output = capturedOutput()
  const invocation = await run(testModule({ commands: [Missing] }), {
    argv: ['search', '--help'],
    stderr: output.stream,
  })
  expect(invocation.exitCode).toBe(1)
  expect(output.text()).toBe('Unknown option: --help.\n')
  expect(selected).toBe('')
})

const capturedOutput = () => {
  const chunks: Buffer[] = []
  const stream = new Writable({
    write(
      chunk: string | Uint8Array,
      _encoding: BufferEncoding,
      callback: (error?: Error | null) => void,
    ) {
      chunks.push(Buffer.from(chunk))
      callback()
    },
  })

  return {
    stream,
    text: () => Buffer.concat(chunks).toString('utf8'),
  }
}
