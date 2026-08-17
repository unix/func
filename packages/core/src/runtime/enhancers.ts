import 'reflect-metadata/lite'
import type { ErrorScope, Exception, ExceptionCode } from '../shared/errors'
import { Injectable } from '../di/decorators'
import type { ProviderToken, Type } from '../di/types'
import { createToken } from '../di/token'
import type { Context } from './context'
import type { OptionParams } from '../options/types'

export interface CallHandler<T = unknown> {
  handle(): Promise<T>
}

export interface Interceptor<T = unknown, Result = unknown> {
  intercept(context: Context, next: CallHandler<T>): Promise<Result> | Result
}

export interface ExceptionFilter<T extends Exception = Exception> {
  catch(exception: T, context: Context): Promise<unknown> | unknown
}

export type ExceptionMatcher = ErrorScope | ExceptionCode | Type<Error> | string

export const APP_FILTER = createToken<ExceptionFilter>('func.app-filter')
export const APP_INTERCEPTOR = createToken<Interceptor>('func.app-interceptor')
export const MODULE_FILTER = createToken<ExceptionFilter>('func.module-filter')
export const MODULE_INTERCEPTOR = createToken<Interceptor>('func.module-interceptor')
export const MODULE_OPTION = createToken<OptionParams>('func.module-option')

const multiProviderTokens = new Set<ProviderToken>([
  APP_FILTER,
  APP_INTERCEPTOR,
  MODULE_FILTER,
  MODULE_INTERCEPTOR,
  MODULE_OPTION,
])

const metadata = {
  CATCH: Symbol('func.catch'),
  FILTERS: Symbol('func.filters'),
  INTERCEPTORS: Symbol('func.interceptors'),
} as const

export const Catch =
  (...matchers: ExceptionMatcher[]): ClassDecorator =>
  target => {
    Injectable()(target)
    Reflect.defineMetadata(metadata.CATCH, Object.freeze(matchers.slice()), target)
  }

export const UseFilters =
  (...filters: Type<ExceptionFilter>[]): ClassDecorator =>
  target => {
    Reflect.defineMetadata(metadata.FILTERS, Object.freeze(filters.slice()), target)
  }

export const UseInterceptors =
  (...interceptors: Type<Interceptor>[]): ClassDecorator =>
  target => {
    Reflect.defineMetadata(
      metadata.INTERCEPTORS,
      Object.freeze(interceptors.slice()),
      target,
    )
  }

export const catchMatchers = (
  target: Function,
): readonly ExceptionMatcher[] | undefined => {
  const value: unknown = Reflect.getMetadata(metadata.CATCH, target)
  return isExceptionMatcherList(value) ? value : undefined
}

export const filtersFor = (target: Type): readonly Type<ExceptionFilter>[] => {
  const value: unknown = Reflect.getMetadata(metadata.FILTERS, target)
  return isTypeList<ExceptionFilter>(value) ? value : []
}

export const interceptorsFor = (target: Type): readonly Type<Interceptor>[] => {
  const value: unknown = Reflect.getMetadata(metadata.INTERCEPTORS, target)
  return isTypeList<Interceptor>(value) ? value : []
}

export const isMultiProviderToken = (token: ProviderToken): boolean =>
  multiProviderTokens.has(token)

const isExceptionMatcherList = (
  value: unknown,
): value is readonly ExceptionMatcher[] =>
  Array.isArray(value) &&
  value.every(
    matcher => typeof matcher === 'string' || typeof matcher === 'function',
  )

const isTypeList = <T>(value: unknown): value is readonly Type<T>[] =>
  Array.isArray(value) && value.every(item => typeof item === 'function')
