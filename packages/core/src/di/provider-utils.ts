import 'reflect-metadata/lite'
import { SYSTEM } from '@func/contracts/core-errors'
import { InternalException } from '../shared/errors'
import { metadata as optionMetadata } from '../options/metadata'
import { metadata as diMetadata } from './metadata'
import type {
  FactoryProvider,
  NormalizedProvider,
  ProviderToken,
  Type,
} from './types'
import { isInjectionToken } from './token'

export const isProviderToken = (value: unknown): value is ProviderToken =>
  typeof value === 'function' || isInjectionToken(value)

export const providerTokenName = (token: ProviderToken): string => {
  if (typeof token === 'function') return token.name || '(anonymous class)'
  return token.description
}

export const normalizeProvider = (provider: unknown): NormalizedProvider => {
  if (isType(provider)) {
    validateInjectable(provider, provider)

    return {
      definition: { provide: provider, useClass: provider },
      token: provider,
    }
  }

  if (!provider || typeof provider !== 'object') {
    throw invalidProvider(provider, 'Provider must be a class or provider object.')
  }

  const provide = propertyValue(provider, 'provide')
  if (!isProviderToken(provide)) {
    throw invalidProvider(provider, 'Provider must declare a valid token.')
  }

  const hasUseClass = Object.prototype.hasOwnProperty.call(provider, 'useClass')
  const hasUseValue = Object.prototype.hasOwnProperty.call(provider, 'useValue')
  const hasUseFactory = Object.prototype.hasOwnProperty.call(provider, 'useFactory')
  const strategies = [hasUseClass, hasUseValue, hasUseFactory].filter(Boolean)
  if (strategies.length !== 1) {
    throw invalidProvider(
      provider,
      'Provider must declare exactly one of useClass, useValue, or useFactory.',
    )
  }

  if (hasUseClass) {
    const useClass = propertyValue(provider, 'useClass')
    if (!isType(useClass)) {
      throw invalidProvider(provider, 'useClass must be a constructible class.')
    }
    validateInjectable(useClass, provide)

    return {
      definition: { provide, useClass },
      token: provide,
    }
  }

  if (hasUseFactory) {
    const useFactory = propertyValue(provider, 'useFactory')
    if (!isFactory(useFactory)) {
      throw invalidProvider(provider, 'useFactory must be a function.')
    }
    const inject = propertyValue(provider, 'inject')
    if (inject !== undefined && !isProviderTokenList(inject)) {
      throw invalidProvider(
        provider,
        'useFactory inject must contain valid provider tokens.',
      )
    }

    return {
      definition: {
        provide,
        useFactory,
        ...(inject === undefined ? {} : { inject }),
      },
      token: provide,
    }
  }

  return {
    definition: {
      provide,
      useValue: propertyValue(provider, 'useValue'),
    },
    token: provide,
  }
}

const propertyValue = (value: object, property: string): unknown =>
  Reflect.get(value, property)

const isType = (value: unknown): value is Type => typeof value === 'function'

const isFactory = (value: unknown): value is FactoryProvider['useFactory'] =>
  typeof value === 'function'

const isProviderTokenList = (value: unknown): value is ProviderToken[] =>
  isUnknownArray(value) && value.every(isProviderToken)

const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value)

const validateInjectable = (target: Type, token: ProviderToken) => {
  const injectable: unknown = Reflect.getOwnMetadata(
    diMetadata.INJECTABLE_IDENTIFIER,
    target,
  )
  const optionCommand = Reflect.hasMetadata(
    optionMetadata.OPTION_COMMAND_IDENTIFIER,
    target,
  )
  if (injectable === true || optionCommand) return

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
