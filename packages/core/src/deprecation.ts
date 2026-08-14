import 'reflect-metadata/lite'
import { SYSTEM } from '@func/shared/core-errors'
import type { Deprecation, HandlerParams } from './interfaces'
import { updateFieldMetadata } from './options/field-metadata'
import { InternalException } from './shared/errors'
import { metadata } from './utils/metadata'

type DeprecatedDecorator = MethodDecorator & PropertyDecorator

export const Deprecated = (message?: string): DeprecatedDecorator => {
  const deprecated = normalizeDeprecation(message ?? true) ?? true

  return (
    target: Object,
    propertyKey: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    if (typeof target === 'function' || typeof propertyKey !== 'string') return
    if (descriptor && typeof descriptor.value === 'function') {
      updateMethodDeprecation(target, propertyKey, deprecated)
      return
    }

    updateFieldMetadata(target, propertyKey, field => ({
      ...field,
      deprecated,
    }))
  }
}

export const compileMethodHandlers = (target: Function): HandlerParams[] => {
  const handlers = (Reflect.getMetadata(
    metadata.METHOD_HANDLER_IDENTIFIER,
    target,
  ) ?? []) as HandlerParams[]
  const deprecations = methodDeprecations(target)

  return handlers.map(handler => {
    const deprecated = deprecations.get(handler.methodName)
    if (!deprecated) return handler
    if (handler.flag) return { ...handler, deprecated }

    throw new InternalException(SYSTEM.INVALID_METHOD_DECORATOR_TARGET, {
      details: {
        handler: handler.methodName,
        reason: 'deprecated-handler-requires-flag',
      },
      message: `@Deprecated on handler "${handler.methodName}" requires @Handler({ flag }).`,
    })
  })
}

export const normalizeDeprecation = (
  value: Deprecation | undefined,
): Deprecation | undefined => {
  if (typeof value === 'string') return value.trim() || true
  return value === true ? true : undefined
}

const updateMethodDeprecation = (
  target: Object,
  propertyKey: string,
  deprecated: Deprecation,
) => {
  const deprecations = new Map(methodDeprecations(target.constructor))
  deprecations.set(propertyKey, deprecated)
  Reflect.defineMetadata(
    metadata.METHOD_DEPRECATION_IDENTIFIER,
    deprecations,
    target.constructor,
  )
}

const methodDeprecations = (target: Function): ReadonlyMap<string, Deprecation> => {
  const deprecations = Reflect.getMetadata(
    metadata.METHOD_DEPRECATION_IDENTIFIER,
    target,
  ) as ReadonlyMap<string, Deprecation> | undefined
  return deprecations ?? new Map()
}
