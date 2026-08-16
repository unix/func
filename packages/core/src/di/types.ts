import type { InjectionToken } from './token'

export type Type<T = any> = new (...args: any[]) => T

export type ProviderToken<T = unknown> = Type<T> | InjectionToken<T>

export interface ClassProvider<T = any> {
  provide: ProviderToken<T>
  useClass: Type<T>
}

export interface ValueProvider<T = any> {
  provide: ProviderToken<T>
  useValue: T
}

export interface FactoryProvider<T = any> {
  provide: ProviderToken<T>
  useFactory: (...dependencies: any[]) => T | Promise<T>
  inject?: ProviderToken[]
}

export type ExplicitProvider<T = any> =
  ClassProvider<T> | ValueProvider<T> | FactoryProvider<T>

export type Provider<T = any> = Type<T> | ExplicitProvider<T>

export interface NormalizedProvider<T = any> {
  definition: ExplicitProvider<T>
  token: ProviderToken<T>
}
