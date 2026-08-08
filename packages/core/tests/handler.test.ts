import 'reflect-metadata'
import { CommandMajor, Container, F_SYSTEM, Handler } from '../src'
import { metadata } from '../src/utils/metadata'
import { expect, test } from './_test'

test('should collect default and flag method handlers', () => {
  class CommandHandler {
    @Handler()
    run() {}

    @Handler({ flag: 'help', alias: 'h', description: 'Show help' })
    help() {}
  }

  expect(
    Reflect.getMetadata(metadata.METHOD_HANDLER_IDENTIFIER, CommandHandler),
  ).toEqual([
    {
      methodName: 'run',
    },
    {
      flag: 'help',
      alias: 'h',
      description: 'Show help',
      methodName: 'help',
    },
  ])
})

test('should reject handler alias without a flag', () => {
  expect(() => {
    class CommandHandler {
      @Handler({ alias: 'h' })
      help() {}
    }

    return CommandHandler
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.HANDLER_ALIAS_REQUIRES_FLAG }))
})

test('should reject path mixed with flag or alias', () => {
  expect(() => {
    class CommandHandler {
      @Handler({ flag: 'help', path: ['get'] })
      help() {}
    }

    return CommandHandler
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.HANDLER_FLAG_PATH_CONFLICT }))

  expect(() => {
    class CommandHandler {
      @Handler({ path: ['get'], alias: 'g' })
      get() {}
    }

    return CommandHandler
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.HANDLER_PATH_ALIAS_CONFLICT }))
})

test('should reject invalid handler targets and params', () => {
  expect(() => {
    class CommandHandler {
      @Handler()
      static run() {}
    }

    return CommandHandler
  }).toThrow(
    expect.objectContaining({ code: F_SYSTEM.INVALID_METHOD_DECORATOR_TARGET }),
  )

  expect(() => {
    class CommandHandler {
      @Handler({ flag: '-help' })
      help() {}
    }

    return CommandHandler
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_TOKEN }))

  expect(() => {
    class CommandHandler {
      @Handler({ flag: 'help', alias: 'hh' })
      help() {}
    }

    return CommandHandler
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_OPTION_ALIAS }))
})

test('should reject multiple default handlers', () => {
  @CommandMajor()
  class Major {
    @Handler()
    first() {}

    @Handler()
    second() {}
  }

  expect(() => new Container([Major])).toThrow(
    expect.objectContaining({ code: F_SYSTEM.MULTIPLE_DEFAULT_HANDLERS }),
  )
})
