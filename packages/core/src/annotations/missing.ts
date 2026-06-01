import 'reflect-metadata'
import { metadata, handlers } from '../utils/metadata'

export const CommandMissing = () => (target: Function) => {
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.MISSING, target)
  return target
}
