import {
  Args,
  CommandMissing,
  Flag,
  Module,
  Handler,
  Injectable,
  createApp,
} from '../src'
import type { Args as ArgsValue, Exception, OnError } from '../src'
import { SYSTEM, expect, run, systemErrorCode, test, testModule } from './_test'

test.sequential(
  'should run an async missing handler with options and providers',
  async () => {
    expect.assertions(4)
    let completed = false

    @Injectable()
    class SearchService {
      query(inputs: readonly string[]) {
        return inputs.join(' ')
      }
    }

    @CommandMissing()
    class Missing {
      @Flag({
        alias: 'j',
      })
      json = false

      constructor(private search: SearchService) {}

      @Handler()
      async run(@Args() args: ArgsValue) {
        await Promise.resolve()
        expect(this.search.query(args.inputs)).toBe('react router')
        expect(this.json).toBe(true)
        expect(args.raw).toEqual(['react', 'router', '--json'])
        completed = true
      }
    }

    @Module({
      commands: [Missing],
      providers: [SearchService],
    })
    class AppModule {}

    await run(AppModule, { argv: ['react', 'router', '--json'] })
    expect(completed).toBe(true)
  },
)

test.sequential('should select missing path handlers', async () => {
  expect.assertions(2)

  @CommandMissing()
  class Missing {
    @Handler({ path: ['search'] })
    search(@Args() args: ArgsValue) {
      expect(args.inputs).toEqual(['react'])
      expect(args.raw).toEqual(['search', 'react'])
    }

    @Handler()
    run() {
      throw new Error('default missing handler should not run')
    }
  }

  await run(testModule({ commands: [Missing] }), { argv: ['search', 'react'] })
})

test.sequential('should select missing flag handlers', async () => {
  let selected = ''

  @CommandMissing()
  class Missing {
    @Handler({ flag: 'help', alias: 'h' })
    help() {
      selected = 'help'
    }

    @Handler()
    run() {
      selected = 'run'
    }
  }

  await run(testModule({ commands: [Missing] }), { argv: ['react', '-h'] })
  expect(selected).toBe('help')
})

test.sequential('should catch missing handler exceptions locally', async () => {
  expect.assertions(1)

  @CommandMissing()
  class Missing implements OnError {
    onError(exception: Exception) {
      expect(exception.message).toBe('boom')
    }

    @Handler()
    run() {
      throw new Error('boom')
    }
  }

  await run(testModule({ commands: [Missing] }), { argv: ['react'] })
})

test('should reject constructor-only missing handlers', () => {
  @CommandMissing()
  class Missing {}

  expect(() => createApp(testModule({ commands: [Missing] }))).toThrow(
    expect.objectContaining({ code: systemErrorCode(SYSTEM.MISSING_HANDLER) }),
  )
})

test('should reject multiple missing handlers', () => {
  @CommandMissing()
  class FirstMissing {}

  @CommandMissing()
  class SecondMissing {}

  expect(() =>
    createApp(testModule({ commands: [FirstMissing, SecondMissing] })),
  ).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.MULTIPLE_MISSING_COMMANDS),
    }),
  )
})
