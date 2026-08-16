import { Inject } from '../di/decorators'
import type { ProviderToken } from '../di/types'
import { createToken } from '../di/token'
import { Context } from './context'
import type { Args as ArgsValue } from './args'
import type { Writable } from 'node:stream'

export { Inject }

export const ARGS = createToken<ArgsValue>('func.args')
export const STDERR = createToken<Writable>('func.stderr')
export const STDOUT = createToken<Writable>('func.stdout')

export type Args = ArgsValue

export const Ctx = (): ParameterDecorator => Inject(Context)
export const Stderr = (): ParameterDecorator => Inject(STDERR)
export const Stdout = (): ParameterDecorator => Inject(STDOUT)

export const isBuiltInToken = (token: ProviderToken): boolean =>
  token === ARGS || token === Context || token === STDERR || token === STDOUT

// TypeScript lets the decorator and its injected type share one public name.
// eslint-disable-next-line no-redeclare
export const Args = (): ParameterDecorator => (target, propertyKey, index) => {
  if (!propertyKey) {
    throw new TypeError('@Args can only decorate a command handler parameter.')
  }

  Inject(ARGS)(target, propertyKey, index)
}
