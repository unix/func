import 'reflect-metadata/lite'
import type { Provider, ProviderToken, Type } from '../di/types'
import { metadata as metadataKeys } from './metadata'

export interface ModuleMetadata {
  commands?: Type[]
  exports?: ProviderToken[]
  imports?: ModuleInput[]
  name?: string
  options?: Type[]
  providers?: Provider[]
}

export type ModuleInput = ModuleMetadata | Type

export const Module =
  (metadata: ModuleMetadata): ClassDecorator =>
  target => {
    defineModuleMetadata(target, metadata)
  }

export const defineModuleMetadata = (target: Function, metadata: ModuleMetadata) => {
  Reflect.defineMetadata(
    metadataKeys.MODULE_IDENTIFIER,
    Object.assign({}, metadata),
    target,
  )
}

export const hasModuleMetadata = (target: Function): boolean =>
  Reflect.hasOwnMetadata(metadataKeys.MODULE_IDENTIFIER, target)

export const moduleMetadata = (input: ModuleInput): ModuleMetadata => {
  if (typeof input !== 'function') return input
  const value: unknown = Reflect.getOwnMetadata(
    metadataKeys.MODULE_IDENTIFIER,
    input,
  )
  return isModuleMetadata(value) ? value : {}
}

const isModuleMetadata = (value: unknown): value is ModuleMetadata =>
  typeof value === 'object' && value !== null
