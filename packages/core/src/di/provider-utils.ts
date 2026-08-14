import 'reflect-metadata/lite'
import { SYSTEM } from '@func/shared/core-errors'
import { InternalException } from '../shared/errors'
import { metadata } from '../utils/metadata'
import type {
  ExplicitProvider,
  NormalizedProvider,
  ProviderToken,
  Type,
} from './provider'
import { isInjectionToken } from './token'

export const isProviderToken = (value: unknown): value is ProviderToken =>
  typeof value === 'function' || isInjectionToken(value)

export const providerTokenName = (token: ProviderToken): string => {
  if (typeof token === 'function') return token.name || '(anonymous class)'
  return token.description
}

export const normalizeProvider = (provider: unknown): NormalizedProvider => {
  if (typeof provider === 'function') {
    const target = provider as Type
    validateInjectable(target, target)

    return {
      definition: { provide: target, useClass: target },
      token: target,
    }
  }

  if (!provider || typeof provider !== 'object') {
    throw invalidProvider(provider, 'Provider must be a class or provider object.')
  }

  const definition = provider as Partial<ExplicitProvider>
  if (!isProviderToken(definition.provide)) {
    throw invalidProvider(provider, 'Provider must declare a valid token.')
  }

  const strategies = [
    Object.prototype.hasOwnProperty.call(definition, 'useClass'),
    Object.prototype.hasOwnProperty.call(definition, 'useValue'),
    Object.prototype.hasOwnProperty.call(definition, 'useFactory'),
  ].filter(Boolean)
  if (strategies.length !== 1) {
    throw invalidProvider(
      provider,
      'Provider must declare exactly one of useClass, useValue, or useFactory.',
    )
  }

  if ('useClass' in definition) {
    if (typeof definition.useClass !== 'function') {
      throw invalidProvider(provider, 'useClass must be a constructible class.')
    }
    validateInjectable(definition.useClass, definition.provide)
  }

  if ('useFactory' in definition) {
    if (typeof definition.useFactory !== 'function') {
      throw invalidProvider(provider, 'useFactory must be a function.')
    }
    if (
      definition.inject !== undefined &&
      (!Array.isArray(definition.inject) ||
        definition.inject.some(token => !isProviderToken(token)))
    ) {
      throw invalidProvider(
        provider,
        'useFactory inject must contain valid provider tokens.',
      )
    }
  }

  return {
    definition: provider as ExplicitProvider,
    token: definition.provide,
  }
}

const validateInjectable = (target: Type, token: ProviderToken) => {
  const injectable = Reflect.getOwnMetadata(
    metadata.INJECTABLE_IDENTIFIER,
    target,
  ) as boolean | undefined
  const optionCommand = Reflect.hasMetadata(
    metadata.OPTION_COMMAND_IDENTIFIER,
    target,
  )
  if (injectable || optionCommand) return

  throw new InternalException(SYSTEM.INVALID_PROVIDER, {
    details: {
      provider: target.name,
      token: providerTokenName(token),
    },
    message: `Provider "${providerTokenName(token)}" must use an @Injectable class.`,
  })
}

const invalidProvider = (provider: unknown, message: string) =>
  new InternalException(SYSTEM.INVALID_PROVIDER, {
    details: { provider },
    message,
  })
