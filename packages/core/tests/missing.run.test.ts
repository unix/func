import {
  Args,
  Catch,
  CommandMissing,
  Container,
  Exception,
  F_SYSTEM,
  Flag,
  FuncArgs,
  FuncException,
  FuncModule,
  Handler,
  Service,
  run,
} from '../src'
import { expect, test } from './_test'

test.sequential(
  'should run an async missing handler with options and services',
  async () => {
    expect.assertions(5)
    let completed = false

    @Service()
    class SearchService {
      query(inputs: string[]) {
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
      async run(@Args() args: FuncArgs) {
        await Promise.resolve()
        expect(this.search.query(args.inputs)).toBe('react router')
        expect(this.json).toBe(true)
        expect(args.command).toBeUndefined()
        expect(args.handler?.methodName).toBe('run')
        completed = true
      }
    }

    @FuncModule({
      commands: [Missing],
      services: [SearchService],
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
    search(@Args() args: FuncArgs) {
      expect(args.inputs).toEqual(['react'])
      expect(args.path).toEqual(['search'])
    }

    @Handler()
    run() {
      throw new Error('default missing handler should not run')
    }
  }

  await run({ commands: [Missing] }, { argv: ['search', 'react'] })
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

  await run({ commands: [Missing] }, { argv: ['react', '-h'] })

  expect(selected).toBe('help')
})

test.sequential('should catch missing handler exceptions locally', async () => {
  expect.assertions(1)

  @CommandMissing()
  class Missing {
    @Catch()
    onError(@Exception() exception: FuncException) {
      expect(exception.message).toBe('boom')
    }

    @Handler()
    run() {
      throw new Error('boom')
    }
  }

  await run({ commands: [Missing] }, { argv: ['react'] })
})

test('should preserve legacy constructor-only missing handlers', async ({
  runContainer,
}) => {
  expect.assertions(1)

  @CommandMissing()
  class Missing {
    constructor(@Args() args: FuncArgs) {
      expect(args.inputs).toEqual(['react'])
    }
  }

  await runContainer(['', '', 'react'], [Missing])
})

test('should reject multiple missing handlers', () => {
  @CommandMissing()
  class FirstMissing {}

  @CommandMissing()
  class SecondMissing {}

  expect(() => new Container([FirstMissing, SecondMissing])).toThrow(
    expect.objectContaining({ code: F_SYSTEM.DUPLICATE_HANDLER }),
  )
})
