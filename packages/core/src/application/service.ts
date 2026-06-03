import 'reflect-metadata'
import { metadata } from '../utils/metadata'

export const Service = (): ClassDecorator => target => {
  Reflect.defineMetadata(metadata.SERVICE_IDENTIFIER, true, target)
}
