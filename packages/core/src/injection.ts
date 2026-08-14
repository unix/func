import { Inject } from './di/decorators'
import type { ProviderToken } from './di/provider'
import { createToken } from './di/token'
import { Context } from './context'
import type { Args as ArgsValue } from './interfaces'

export { Inject }

export const ARGS = createToken<ArgsValue>('func.args')

export type Args = ArgsValue

export const isBuiltInToken = (token: ProviderToken): boolean =>
  token === ARGS || token === Context

// TypeScript lets the decorator and its injected type share one public name.
// eslint-disable-next-line no-redeclare
export const Args = (): ParameterDecorator => (target, propertyKey, index) => {
  if (!propertyKey) {
    throw new TypeError('@Args can only decorate a command handler parameter.')
  }

  Inject(ARGS)(target, propertyKey, index)
}
