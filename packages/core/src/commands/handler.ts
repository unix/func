import 'reflect-metadata/lite'
import { SYSTEM } from '@func/shared/core-errors'
import type {
  HandlerDecoratorInput,
  HandlerDecoratorParams,
  HandlerParams,
  HandlerPath,
} from '../interfaces'
import { InternalException } from '../shared/errors'
import * as validator from '../utils/validator'
import { metadata } from '../utils/metadata'

interface HandlerDecorator {
  (input?: HandlerDecoratorInput): MethodDecorator
}

export const Handler: HandlerDecorator = (input: HandlerDecoratorInput = {}) => {
  const params = normalizeHandler(input)

  return (target, propertyKey) => {
    if (typeof target === 'function' || typeof propertyKey !== 'string') {
      throw new InternalException(SYSTEM.INVALID_METHOD_DECORATOR_TARGET, {
        details: { method: String(propertyKey) },
        message: `Handler "${String(propertyKey)}" must decorate an instance method.`,
      })
    }

    const handlers: HandlerParams[] =
      Reflect.getMetadata(metadata.METHOD_HANDLER_IDENTIFIER, target.constructor) ??
      []
    Reflect.defineMetadata(
      metadata.METHOD_HANDLER_IDENTIFIER,
      handlers.concat([
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

const normalizeHandler = (input: HandlerDecoratorInput): HandlerParams => {
  const params = isHandlerParams(input) ? input : { path: input }
  const hasPath = Object.prototype.hasOwnProperty.call(params, 'path')
  const hasFlag = Object.prototype.hasOwnProperty.call(params, 'flag')
  const aliases = validator.optionAliases(params.alias, params.aliases)

  if (hasPath && hasFlag) {
    throw new InternalException(SYSTEM.HANDLER_FLAG_PATH_CONFLICT, {
      details: { flag: params.flag, path: params.path },
      message: 'Handler flag and path cannot be used together.',
    })
  }

  if (!params.flag && aliases.length) {
    throw new InternalException(SYSTEM.HANDLER_ALIAS_REQUIRES_FLAG, {
      details: { alias: aliases[0], aliases, key: 'flag' },
      message: 'Handler aliases require a flag.',
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
