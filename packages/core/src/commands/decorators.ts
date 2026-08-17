import 'reflect-metadata/lite'
import { SYSTEM } from '@func/contracts/core-errors'
import { normalizeDeprecation } from '../deprecation'
import * as validator from '../definition-validation'
import { InternalException } from '../shared/errors'
import { handlers, metadata } from './metadata'
import type {
  CommandDecoratorInput,
  CommandDecoratorParams,
  CommandParams,
  CommandPath,
  HandlerDecoratorInput,
  HandlerDecoratorParams,
  HandlerParams,
  HandlerPath,
} from './types'

interface CommandDecorator {
  (input: CommandDecoratorInput): ClassDecorator
}

interface HandlerDecorator {
  (input?: HandlerDecoratorInput): MethodDecorator
}

export const Command: CommandDecorator = input => target => {
  const command = normalizeCommand(input)
  Reflect.defineMetadata(metadata.COMMAND_IDENTIFIER, command, target)
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.COMMAND, target)
}

export const Handler: HandlerDecorator = (input: HandlerDecoratorInput = {}) => {
  const params = normalizeHandler(input)

  return (target, propertyKey) => {
    if (typeof target === 'function' || typeof propertyKey !== 'string') {
      throw new InternalException(SYSTEM.INVALID_METHOD_DECORATOR_TARGET, {
        details: { method: String(propertyKey) },
      })
    }

    const storedHandlers: unknown = Reflect.getMetadata(
      metadata.METHOD_HANDLER_IDENTIFIER,
      target.constructor,
    )
    const methodHandlers = isHandlerParamsList(storedHandlers) ? storedHandlers : []
    Reflect.defineMetadata(
      metadata.METHOD_HANDLER_IDENTIFIER,
      methodHandlers.concat([
        {
          ...params,
          methodName: propertyKey,
          path: params.path.slice(),
        },
      ]),
      target.constructor,
    )
  }
}

export const CommandMajor = (): ClassDecorator => target => {
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.MAJOR, target)
}

export const CommandMissing = (): ClassDecorator => target => {
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.MISSING, target)
}

const normalizeCommand = (input: CommandDecoratorInput): CommandParams => {
  const params = isCommandParams(input) ? input : { path: input }
  const path = normalizeCommandPath(params.path)
  const aliases = validator.commandAliases(params.alias, params.aliases)
  const deprecated = normalizeDeprecation(params.deprecated)

  return {
    aliases,
    ...(deprecated ? { deprecated } : {}),
    ...(params.description ? { description: params.description } : {}),
    path,
  }
}

const isCommandParams = (
  input: CommandDecoratorInput,
): input is CommandDecoratorParams =>
  typeof input === 'object' && !Array.isArray(input)

const normalizeCommandPath = (input: CommandPath): string[] => {
  const path: string[] = typeof input === 'string' ? [input] : [...input]
  if (!path.length) validator.commandName('', 'path')
  path.forEach(segment => validator.commandName(segment, 'path'))
  return path
}

const normalizeHandler = (input: HandlerDecoratorInput): HandlerParams => {
  const params = isHandlerParams(input) ? input : { path: input }
  const hasPath = Object.prototype.hasOwnProperty.call(params, 'path')
  const hasFlag = Object.prototype.hasOwnProperty.call(params, 'flag')
  const aliases = validator.optionAliases(params.alias, params.aliases)

  if (hasPath && hasFlag) {
    throw new InternalException(SYSTEM.HANDLER_FLAG_PATH_CONFLICT, {
      details: { flag: params.flag, path: params.path },
    })
  }

  if (!params.flag && aliases.length) {
    throw new InternalException(SYSTEM.HANDLER_ALIAS_REQUIRES_FLAG, {
      details: { alias: aliases[0], aliases, key: 'flag' },
    })
  }

  if (hasFlag) validator.optionName(params.flag ?? '', 'flag')

  return {
    aliases,
    ...(params.description ? { description: params.description } : {}),
    ...(params.flag ? { flag: params.flag } : {}),
    methodName: '',
    path: params.flag ? [] : normalizeHandlerPath(params.path),
  }
}

const isHandlerParams = (
  input: HandlerDecoratorInput,
): input is HandlerDecoratorParams =>
  typeof input === 'object' && !Array.isArray(input)

const normalizeHandlerPath = (input?: HandlerPath): string[] => {
  if (input === undefined || input === '') return []
  const path = typeof input === 'string' ? [input] : input.slice()
  if (!path.length) validator.commandName('', 'path')
  path.forEach(segment => validator.commandName(segment, 'path'))
  return path
}

const isHandlerParamsList = (value: unknown): value is HandlerParams[] =>
  isUnknownArray(value) && value.every(isHandlerMetadata)

const isHandlerMetadata = (value: unknown): value is HandlerParams =>
  isUnknownRecord(value) &&
  isStringList(value.aliases) &&
  isStringList(value.path) &&
  typeof value.methodName === 'string'

const isStringList = (value: unknown): value is string[] =>
  isUnknownArray(value) && value.every(item => typeof item === 'string')

const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value)

const isUnknownRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
