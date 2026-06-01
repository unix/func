import 'reflect-metadata'
import { metadata, handlers } from '../utils/metadata'

export const CommandError = () => target => {
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.ERROR, target)
  return target
}
