import 'reflect-metadata/lite'
import { SYSTEM } from '@func/contracts/core-errors'
import { InternalException } from '../shared/errors'
import { metadata } from './metadata'
import type { ProviderToken } from './types'
import { isProviderToken } from './provider-utils'

export const Injectable = (): ClassDecorator => target => {
  Reflect.defineMetadata(metadata.INJECTABLE_IDENTIFIER, true, target)
}

export const Inject = (token: ProviderToken): ParameterDecorator => {
  if (!isProviderToken(token)) {
    throw new InternalException(SYSTEM.INVALID_TOKEN, {
      details: { token },
    })
  }

  return (target, propertyKey, parameterIndex) => {
    const tokens = parameterTokens(target, propertyKey)
    const nextTokens = Object.assign({}, tokens, { [parameterIndex]: token })
    if (propertyKey) {
      Reflect.defineMetadata(
        metadata.PARAMETER_TOKENS_IDENTIFIER,
        nextTokens,
        target,
        propertyKey,
      )
      return
    }

    Reflect.defineMetadata(metadata.PARAMETER_TOKENS_IDENTIFIER, nextTokens, target)
  }
}

export const parameterTokens = (
  target: object,
  propertyKey?: string | symbol,
): Partial<Record<number, ProviderToken>> => {
  const value: unknown = propertyKey
    ? Reflect.getMetadata(metadata.PARAMETER_TOKENS_IDENTIFIER, target, propertyKey)
    : Reflect.getMetadata(metadata.PARAMETER_TOKENS_IDENTIFIER, target)
  return isParameterTokenMap(value) ? value : {}
}

const isParameterTokenMap = (
  value: unknown,
): value is Partial<Record<number, ProviderToken>> =>
  isUnknownRecord(value) &&
  Object.entries(value).every(
    ([index, token]) => Number.isInteger(Number(index)) && isProviderToken(token),
  )

const isUnknownRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
