import 'reflect-metadata'
import { metadata, handlers } from '../constants/metadata'

export const CommandNotFound = () => target => {
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.NOT_FOUND, target)
  return target
}
