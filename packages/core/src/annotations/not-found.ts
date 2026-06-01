import 'reflect-metadata'
import { metadata, handlers } from '../utils/metadata'
import { F_EFFECT, errorTypes, handleEffect } from '../errors'

export const CommandNotFound = (): ClassDecorator => target => {
  handleEffect(
    F_EFFECT.DEPRECATED_API,
    errorTypes.DEPRECATION,
    '> func: "CommandNotFound" is a deprecation. Please use "CommandMissing" instead of it.',
    { api: 'CommandNotFound', replacement: 'CommandMissing' },
  )
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.MISSING, target)
}
