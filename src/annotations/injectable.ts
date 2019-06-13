import 'reflect-metadata'
import { metadata } from '../constants/metadata'

export const Injectable = () => target => {
  const types: any[] = Reflect.getMetadata(metadata.DESIGN_PARAM_TYPES, target)
  Reflect.defineMetadata(metadata.HOST_PARAM_TYPES, types, target)
  return target
}
