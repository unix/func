import 'reflect-metadata'
import {
  F_SYSTEM,
  createSystemError,
  errorTypes,
} from '../errors'
import { metadata } from '../utils/metadata'

export interface CatchParams {
  methodName: string
}

export const Catch =
  (): MethodDecorator =>
  (target, propertyKey) => {
    if (typeof target === 'function' || typeof propertyKey !== 'string') {
      throw createSystemError(
        F_SYSTEM.INVALID_PARAM_TYPE,
        errorTypes.DEFINITION,
        `Catch "${String(propertyKey)}" must decorate an instance method.`,
        { method: String(propertyKey) },
      )
    }

    const catches: CatchParams[] =
      Reflect.getMetadata(metadata.METHOD_CATCH_IDENTIFIER, target.constructor) || []
    Reflect.defineMetadata(
      metadata.METHOD_CATCH_IDENTIFIER,
      catches.concat([{ methodName: propertyKey }]),
      target.constructor,
    )
  }
