import 'reflect-metadata'
import { metadata, handlers } from '../utils/metadata'

export const CommandError = (): ClassDecorator => target => {
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.ERROR, target)
}
