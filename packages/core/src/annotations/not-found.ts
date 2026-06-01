import 'reflect-metadata'
import { metadata, handlers } from '../constants/metadata'

export const CommandNotFound = () => target => {
  console.warn(
    '> func: "CommandNotFound" is a deprecation. Please use "CommandMissing" instead of it.',
  )
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.MISSING, target)
  return target
}
