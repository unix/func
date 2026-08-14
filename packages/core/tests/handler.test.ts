import 'reflect-metadata/lite'
import { CommandMajor, Handler, createApp } from '../src'
import { metadata } from '../src/utils/metadata'
import { SYSTEM, expect, systemErrorCode, test, testModule } from './_test'

test('should collect default and flag method handlers', () => {
  class CommandHandler {
    @Handler()
    run() {}

    @Handler({
      flag: 'help',
      alias: 'h',
      aliases: ['?', 'h'],
      description: 'Show help',
    })
    help() {}
  }

  expect(
    Reflect.getMetadata(metadata.METHOD_HANDLER_IDENTIFIER, CommandHandler),
  ).toEqual([
    {
      aliases: [],
      methodName: 'run',
      path: [],
    },
    {
      flag: 'help',
      aliases: ['h', '?'],
      description: 'Show help',
      methodName: 'help',
      path: [],
    },
  ])
})

test('should normalize string, array, and empty handler paths', () => {
  class CommandHandler {
    @Handler('')
    root() {}

    @Handler('self')
    self() {}

    @Handler(['member', 'add'])
    addMember() {}

    @Handler({ path: 'settings' })
    settings() {}
  }

  expect(
    Reflect.getMetadata(metadata.METHOD_HANDLER_IDENTIFIER, CommandHandler),
  ).toEqual([
    { aliases: [], methodName: 'root', path: [] },
    { aliases: [], methodName: 'self', path: ['self'] },
    { aliases: [], methodName: 'addMember', path: ['member', 'add'] },
    { aliases: [], methodName: 'settings', path: ['settings'] },
  ])
})

test('should reject handler alias without a flag', () => {
  expect(() => {
    class CommandHandler {
      @Handler({ alias: 'h' } as any)
      help() {}
    }

    return CommandHandler
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.HANDLER_ALIAS_REQUIRES_FLAG),
    }),
  )

  expect(() => {
    class CommandHandler {
      @Handler({ aliases: ['h', '?'] } as any)
      help() {}
    }

    return CommandHandler
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.HANDLER_ALIAS_REQUIRES_FLAG),
    }),
  )
})

test('should reject path mixed with flag or alias', () => {
  expect(() => {
    class CommandHandler {
      @Handler({ flag: 'help', path: ['get'] } as any)
      help() {}
    }

    return CommandHandler
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.HANDLER_FLAG_PATH_CONFLICT),
    }),
  )

  expect(() => {
    class CommandHandler {
      @Handler({ path: ['get'], alias: 'g' } as any)
      get() {}
    }

    return CommandHandler
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.HANDLER_ALIAS_REQUIRES_FLAG),
    }),
  )
})

test('should reject invalid handler targets and params', () => {
  expect(() => {
    class CommandHandler {
      @Handler()
      static run() {}
    }

    return CommandHandler
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_METHOD_DECORATOR_TARGET),
    }),
  )

  expect(() => {
    class CommandHandler {
      @Handler({ flag: '-help' })
      help() {}
    }

    return CommandHandler
  }).toThrow(
    expect.objectContaining({ code: systemErrorCode(SYSTEM.INVALID_TOKEN) }),
  )

  expect(() => {
    class CommandHandler {
      @Handler({ flag: 'help', alias: 'hh' })
      help() {}
    }

    return CommandHandler
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_OPTION_ALIAS),
    }),
  )
})

test('should reject multiple default handlers', () => {
  @CommandMajor()
  class Major {
    @Handler()
    first() {}

    @Handler()
    second() {}
  }

  expect(() => createApp(testModule({ commands: [Major] }))).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.MULTIPLE_DEFAULT_HANDLERS),
    }),
  )
})

test('should allow handler paths named like object prototype properties', () => {
  @CommandMajor()
  class Major {
    @Handler('__proto__')
    prototype() {}
  }

  expect(() => createApp(testModule({ commands: [Major] }))).not.toThrow()
})
