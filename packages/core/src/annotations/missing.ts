import 'reflect-metadata'
import { metadata, handlers } from '../utils/metadata'

export const CommandMissing = (): ClassDecorator => target => {
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.MISSING, target)
}
