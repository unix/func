import 'reflect-metadata'
import { metadata, handlers } from '../utils/metadata'

export const CommandMajor = () => target => {
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.MAJOR, target)
  return target
}
