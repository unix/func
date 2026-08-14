import 'reflect-metadata/lite'
import { metadata, handlers } from '../utils/metadata'

export const CommandMajor = (): ClassDecorator => target => {
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.MAJOR, target)
}
