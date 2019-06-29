import 'reflect-metadata'
import { metadata, handlers } from '../constants/metadata'

export const CommandMissing = () => target => {
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.MISSING, target)
  return target
}
