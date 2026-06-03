import 'reflect-metadata'
import { F_SYSTEM, Handler } from '../src'
import { metadata } from '../src/utils/metadata'
import { expect, test } from './_test'

test('should collect default and flag method handlers', () => {
  class CommandHandler {
    @Handler()
    run() {}

    @Handler({ flag: 'help', alias: 'h', description: 'Show help' })
    help() {}
  }

  expect(Reflect.getMetadata(metadata.METHOD_HANDLER_IDENTIFIER, CommandHandler)).toEqual([
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
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.MISSING_REQUIRED_PARAM }))
})

test('should reject path mixed with flag or alias', () => {
  expect(() => {
    class CommandHandler {
      @Handler({ flag: 'help', path: ['get'] })
      help() {}
    }

    return CommandHandler
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_PARAM_VALUE }))

  expect(() => {
    class CommandHandler {
      @Handler({ path: ['get'], alias: 'g' })
      get() {}
    }

    return CommandHandler
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_PARAM_VALUE }))
})

test('should reject invalid handler targets and params', () => {
  expect(() => {
    class CommandHandler {
      @Handler()
      static run() {}
    }

    return CommandHandler
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_PARAM_TYPE }))

  expect(() => {
    class CommandHandler {
      @Handler({ flag: '-help' })
      help() {}
    }

    return CommandHandler
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_PARAM_VALUE }))

  expect(() => {
    class CommandHandler {
      @Handler({ flag: 'help', alias: 'hh' })
      help() {}
    }

    return CommandHandler
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_PARAM_VALUE }))
})
