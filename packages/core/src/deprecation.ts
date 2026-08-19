import 'reflect-metadata/lite'
import { SYSTEM } from '@func/contracts/core-errors'
import type { HandlerParams } from './commands/types'
import { updateFieldMetadata } from './options/field-metadata'
import { InternalException } from './shared/errors'
import { metadataValue } from './shared/metadata-value'
import { metadata } from './commands/metadata'

type DeprecatedDecorator = MethodDecorator & PropertyDecorator

export type Deprecation = true | string

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
  const handlers =
    metadataValue<HandlerParams[]>(metadata.METHOD_HANDLER_IDENTIFIER, target) ?? []
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
  return (
    metadataValue<ReadonlyMap<string, Deprecation>>(
      metadata.METHOD_DEPRECATION_IDENTIFIER,
      target,
    ) ?? new Map()
  )
}
