import type { InjectionToken } from './token'

export type Type<T = unknown> = new (...args: never[]) => T

export type ProviderToken<T = unknown> = Type<T> | InjectionToken<T>

export interface ClassProvider<T = unknown> {
  provide: ProviderToken<T>
  useClass: Type<T>
}

export interface ValueProvider<T = unknown> {
  provide: ProviderToken<T>
  useValue: T
}

export interface FactoryProvider<T = unknown> {
  provide: ProviderToken<T>
  useFactory: (...dependencies: never[]) => T | Promise<T>
  inject?: ProviderToken[]
}

export type ExplicitProvider<T = unknown> =
  ClassProvider<T> | ValueProvider<T> | FactoryProvider<T>

export type Provider<T = unknown> = Type<T> | ExplicitProvider<T>

export interface NormalizedProvider<T = unknown> {
  definition: ExplicitProvider<T>
  token: ProviderToken<T>
}
