import 'reflect-metadata'
import { metadata } from './utils/metadata'

export enum injectTokens {
  ARGS = 'args',
  EXCEPTION = 'exception',
  REGS = 'regs',
}

const injectToken =
  (token: injectTokens): ParameterDecorator =>
  (target, propertyKey, parameterIndex) => {
    const metadataTarget = propertyKey ? target : target as Function
    const tokens = propertyKey
      ? Reflect.getMetadata(
        metadata.PARAM_INJECT_TOKEN_IDENTIFIER,
        metadataTarget,
        propertyKey,
      ) || {}
      : Reflect.getMetadata(metadata.PARAM_INJECT_TOKEN_IDENTIFIER, metadataTarget) || {}

    if (propertyKey) {
      Reflect.defineMetadata(
        metadata.PARAM_INJECT_TOKEN_IDENTIFIER,
        Object.assign({}, tokens, { [parameterIndex]: token }),
        metadataTarget,
        propertyKey,
      )
      return
    }

    Reflect.defineMetadata(
      metadata.PARAM_INJECT_TOKEN_IDENTIFIER,
      Object.assign({}, tokens, { [parameterIndex]: token }),
      metadataTarget,
    )
  }

export const Args = (): ParameterDecorator => injectToken(injectTokens.ARGS)

export const Exception = (): ParameterDecorator => injectToken(injectTokens.EXCEPTION)

export const Regs = (): ParameterDecorator => injectToken(injectTokens.REGS)
