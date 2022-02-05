import 'reflect-metadata'
import { metadata, handlers } from '../constants/metadata'

export const CommandMajor = () => target => {
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.MAJOR, target)
  return target
}
