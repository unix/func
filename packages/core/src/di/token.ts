export class InjectionToken<T = unknown> {
  declare private readonly type?: T

  constructor(readonly description: string) {}
}

export const createToken = <T = unknown>(description: string): InjectionToken<T> =>
  Object.freeze(new InjectionToken<T>(description))

export const isInjectionToken = (value: unknown): value is InjectionToken<unknown> =>
  value instanceof InjectionToken
