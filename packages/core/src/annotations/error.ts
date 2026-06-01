import 'reflect-metadata'
import { metadata, handlers } from '../constants/metadata'

export const CommandError = () => target => {
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.ERROR, target)
  return target
}
