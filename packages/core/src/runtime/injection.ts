import { SYSTEM } from '@func/contracts/core-errors'
import { Inject } from '../di/decorators'
import type { ProviderToken } from '../di/types'
import { createToken } from '../di/token'
import { Context } from './context'
import type { Args as ArgsValue, ArgsOptionValue } from './args'
import type { Readable, Writable } from 'node:stream'
import { OutputHost } from './output'
import { InternalException } from '../shared/errors'

export { Inject }

export const ARGS = createToken<ArgsValue<Record<string, unknown>>>('func.args')
export const STDERR = createToken<Writable>('func.stderr')
export const STDIN = createToken<Readable>('func.stdin')
export const STDOUT = createToken<Writable>('func.stdout')

export type Args<
  Options extends Readonly<Record<string, unknown>> = Readonly<
    Record<string, ArgsOptionValue>
  >,
> = ArgsValue<Options>

export const Ctx = (): ParameterDecorator => Inject(Context)
export const Stderr = (): ParameterDecorator => Inject(STDERR)
export const Stdin = (): ParameterDecorator => Inject(STDIN)
export const Stdout = (): ParameterDecorator => Inject(STDOUT)

export const isBuiltInToken = (token: ProviderToken): boolean =>
  token === ARGS ||
  token === Context ||
  token === STDERR ||
  token === STDIN ||
  token === STDOUT ||
  token === OutputHost

// TypeScript lets the decorator and its injected type share one public name.
// eslint-disable-next-line no-redeclare
export const Args = (): ParameterDecorator => (target, propertyKey, index) => {
  if (!propertyKey) {
    throw new InternalException(SYSTEM.INVALID_ARGS_DECORATOR_TARGET, {
      details: { index, target: target.constructor.name },
    })
  }

  Inject(ARGS)(target, propertyKey, index)
}
