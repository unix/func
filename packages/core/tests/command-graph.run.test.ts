import {
  APP_FILTER,
  Args,
  Catch,
  Command,
  Flag,
  Module,
  Handler,
  Injectable,
  Value,
  createApp,
} from '../src'
import type { Args as ArgsValue, Exception, ExceptionFilter } from '../src'
import { Writable } from 'node:stream'
import { compileApplication } from '../src/application/compiler'
import {
  SYSTEM,
  expect,
  objectContaining,
  run,
  systemErrorCode,
  test,
  testModule,
} from './_test'

test('should discard command graph build state after compilation', () => {
  @Command({ aliases: ['u', 'user'], path: 'users' })
  class UsersCommand {
    @Handler()
    run() {}
  }

  const graph = compileApplication(
    testModule({ commands: [UsersCommand] }),
  ).commandGraph
  const canonical = graph.match(['users'])
  const alias = graph.match(['u'])
  const secondAlias = graph.match(['user'])
  expect(canonical).toBeDefined()
  expect(alias?.node).toBe(canonical?.node)
  expect(secondAlias?.node).toBe(canonical?.node)
  expect(canonical?.node).not.toHaveProperty('children')
  expect(canonical?.node).not.toHaveProperty('flagTokens')
  expect(canonical?.node).not.toHaveProperty('optionTokens')
  expect(canonical?.node).not.toHaveProperty('tokenOwners')
  expect(canonical?.node.transitions).toBeInstanceOf(Map)
})

test('should reject method and controller declarations for the same endpoint', () => {
  @Command('users')
  class UsersCommand {
    @Handler('self')
    self() {}
  }

  @Command(['users', 'self'])
  class UserSelfCommand {
    @Handler()
    run() {}
  }

  expect(() =>
    createApp(testModule({ commands: [UsersCommand, UserSelfCommand] })),
  ).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.DUPLICATE_COMMAND_TOKEN),
      details: objectContaining({ token: 'users self' }),
    }),
  )
})

test.sequential(
  'should instantiate only the controller that owns the exact endpoint',
  async ({ runContainer }) => {
    let parentCreated = 0
    let parentInvoked = 0
    let childCreated = 0
    let childInvoked = 0

    @Command('users')
    class UsersCommand {
      constructor() {
        parentCreated += 1
      }

      @Handler()
      run() {
        parentInvoked += 1
      }
    }

    @Command(['users', 'self'])
    class UserSelfCommand {
      constructor() {
        childCreated += 1
      }

      @Handler()
      run() {
        childInvoked += 1
      }
    }

    await runContainer(['', '', 'users', 'self'], [UsersCommand, UserSelfCommand])
    expect({ childCreated, childInvoked, parentCreated, parentInvoked }).toEqual({
      childCreated: 1,
      childInvoked: 1,
      parentCreated: 0,
      parentInvoked: 0,
    })
  },
)

test.sequential(
  'should allow controllers to contribute different endpoints under one prefix',
  async ({ runContainer }) => {
    let selected = ''

    @Command('users')
    class UserQueries {
      @Handler('list')
      list() {
        selected = 'list'
      }
    }

    @Command('users')
    class UserMutations {
      @Handler('create')
      create() {
        selected = 'create'
      }
    }

    await runContainer(['', '', 'users', 'create'], [UserQueries, UserMutations])
    expect(selected).toBe('create')
  },
)

test.sequential(
  'should parse field options for a selected flag endpoint',
  async ({ runContainer }) => {
    expect.assertions(1)

    @Command('users')
    class UsersCommand {
      @Value()
      page: number = 1

      @Handler()
      run() {}
    }

    @Command('users')
    class UsersHelpCommand {
      @Value()
      format: string = 'text'

      @Handler({ flag: 'help' })
      help() {
        expect(this.format).toBe('json')
      }
    }

    await runContainer(
      ['', '', 'users', '--help', '--format', 'json'],
      [UsersCommand, UsersHelpCommand],
    )
  },
)

test.sequential(
  'should reject field options owned by an unselected endpoint',
  async () => {
    expect.assertions(2)
    let invoked = false

    @Catch()
    class AppFilter implements ExceptionFilter {
      catch(exception: Exception) {
        expect(exception.details).toEqual({ options: ['--verbose'] })
      }
    }

    @Command('users')
    class UsersCommand {
      @Handler()
      run() {
        invoked = true
      }
    }

    @Command('users')
    class UsersHelpCommand {
      @Flag()
      verbose = false

      @Handler({ flag: 'help' })
      help() {}
    }

    @Module({
      commands: [UsersCommand, UsersHelpCommand],
      providers: [{ provide: APP_FILTER, useClass: AppFilter }],
    })
    class AppModule {}

    await run(AppModule, { argv: ['users', '--verbose'] })
    expect(invoked).toBe(false)
  },
)

test('should reject incompatible field schemas at one command node', () => {
  @Command('users')
  class UsersCommand {
    @Value('format')
    format: string = 'text'

    @Handler()
    run() {}
  }

  @Command('users')
  class UsersHelpCommand {
    @Flag('format')
    formatted = false

    @Handler({ flag: 'help' })
    help() {}
  }

  expect(() =>
    createApp(testModule({ commands: [UsersCommand, UsersHelpCommand] })),
  ).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.DUPLICATE_OPTION_TOKEN),
      details: objectContaining({ token: '--format' }),
    }),
  )
})

test.sequential('should resolve an endpoint from its owning module', async () => {
  let selected = ''

  @Injectable()
  class UsersService {
    value() {
      return 'users'
    }
  }

  @Injectable()
  class UserSelfService {
    value() {
      return 'self'
    }
  }

  @Command('users')
  class UsersCommand {
    constructor(private readonly users: UsersService) {}

    @Handler()
    run() {
      selected = this.users.value()
    }
  }

  @Command(['users', 'self'])
  class UserSelfCommand {
    constructor(private readonly self: UserSelfService) {}

    @Handler()
    run() {
      selected = this.self.value()
    }
  }

  @Module({ commands: [UsersCommand], providers: [UsersService] })
  class UsersModule {}

  @Module({ commands: [UserSelfCommand], providers: [UserSelfService] })
  class UserSelfModule {}

  @Module({ imports: [UsersModule, UserSelfModule] })
  class AppModule {}

  await run(AppModule, { argv: ['users', 'self'] })
  expect(selected).toBe('self')
})

test.sequential(
  'should expose canonical and invoked paths when matching a prefix alias',
  async ({ runContainer }) => {
    expect.assertions(2)

    @Command({ alias: 'u', aliases: ['user'], path: 'users' })
    class UsersCommand {
      @Handler('self')
      self(@Args() args: ArgsValue) {
        expect(args.path).toEqual(['users', 'self'])
        expect(args.invokedPath).toEqual(['user', 'self'])
      }
    }

    await runContainer(['', '', 'user', 'self'], [UsersCommand])
  },
)

test.sequential(
  'should resolve command paths around known options',
  async ({ runContainer }) => {
    expect.assertions(1)

    @Command('users')
    class UsersCommand {
      @Flag()
      verbose = false

      @Handler('self')
      self() {
        expect(this.verbose).toBe(true)
      }
    }

    await runContainer(['', '', 'users', '--verbose', 'self'], [UsersCommand])
  },
)

test.sequential(
  'should not fall back to an executable ancestor after entering a child node',
  async ({ runContainer }) => {
    let parentInvoked = false

    @Command('users')
    class UsersCommand {
      @Handler()
      run() {
        parentInvoked = true
      }
    }

    @Command(['users', 'self'])
    class UserSelfCommand {
      @Handler('email')
      email() {}
    }

    await expect(
      runContainer(
        ['', '', 'users', 'self', 'unknown'],
        [UsersCommand, UserSelfCommand],
      ),
    ).rejects.toMatchObject({
      code: systemErrorCode(SYSTEM.NO_MATCHING_HANDLER),
    })
    expect(parentInvoked).toBe(false)
  },
)

test.sequential(
  'should not propagate a parent flag handler to a child endpoint',
  async () => {
    let parentCreated = false
    let parentInvoked = false

    @Command('users')
    class UsersCommand {
      constructor() {
        parentCreated = true
      }

      @Handler({ flag: 'help' })
      help() {
        parentInvoked = true
      }
    }

    @Command(['users', 'self'])
    class UserSelfCommand {
      @Handler()
      run() {}
    }

    const stderr = new Writable({
      write(_chunk, _encoding, callback) {
        callback()
      },
    })
    await run(testModule({ commands: [UsersCommand, UserSelfCommand] }), {
      argv: ['users', 'self', '--help'],
      stderr,
    })
    expect(parentCreated).toBe(false)
    expect(parentInvoked).toBe(false)
  },
)
