import 'reflect-metadata'
import { metadata, handlers } from '../utils/metadata'

export const CatchAll = (): ClassDecorator => target => {
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.ERROR, target)
}

export const CommandError = CatchAll
