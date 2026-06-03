import 'reflect-metadata'
import {
  HandlerDecoratorParams,
  HandlerParams,
} from '../interfaces'
import {
  F_SYSTEM,
  createSystemError,
  errorTypes,
} from '../errors'
import * as validator from '../utils/validator'
import { metadata } from '../utils/metadata'

export const Handler =
  (params: HandlerDecoratorParams = {}): MethodDecorator =>
  (target, propertyKey) => {
    if (typeof target === 'function' || typeof propertyKey !== 'string') {
      throw createSystemError(
        F_SYSTEM.INVALID_PARAM_TYPE,
        errorTypes.DEFINITION,
        `Handler "${String(propertyKey)}" must decorate an instance method.`,
        { method: String(propertyKey) },
      )
    }

    if (params.path && params.alias) {
      throw createSystemError(
        F_SYSTEM.INVALID_PARAM_VALUE,
        errorTypes.DEFINITION,
        'Handler path does not support alias.',
        { alias: params.alias, path: params.path },
      )
    }
    if (params.flag && params.path) {
      throw createSystemError(
        F_SYSTEM.INVALID_PARAM_VALUE,
        errorTypes.DEFINITION,
        'Handler flag and path cannot be used together.',
        { flag: params.flag, path: params.path },
      )
    }
    if (!params.flag && params.alias) {
      throw createSystemError(
        F_SYSTEM.MISSING_REQUIRED_PARAM,
        errorTypes.DEFINITION,
        'Handler alias requires a flag.',
        { key: 'flag', alias: params.alias },
      )
    }
    if (params.path) {
      validator.mustBeArray(params.path, 'path')
      params.path.forEach(item => validator.commandName(item, 'path'))
    }
    if (Object.prototype.hasOwnProperty.call(params, 'flag')) {
      validator.optionName(params.flag || '', 'flag')
    }
    validator.optionAlias(params.alias, 'alias')

    const handlers: HandlerParams[] =
      Reflect.getMetadata(metadata.METHOD_HANDLER_IDENTIFIER, target.constructor) || []
    Reflect.defineMetadata(
      metadata.METHOD_HANDLER_IDENTIFIER,
      handlers.concat([
        Object.assign({}, params, {
          methodName: propertyKey,
        }),
      ]),
      target.constructor,
    )
  }
