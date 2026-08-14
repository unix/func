import type {
  ArrayValueDecoratorParams,
  ContainerOptions,
  Deprecation,
  Args,
  ExceptionCode,
  ExceptionDetails,
  ExceptionOptions,
  ModuleMetadata,
} from 'func'
import { main } from 'funcgo'

export type PublishedFuncTypes = [
  ArrayValueDecoratorParams,
  ContainerOptions,
  Deprecation,
  Args,
  ExceptionCode,
  ExceptionDetails,
  ExceptionOptions,
  ModuleMetadata,
]

export const publishedFuncgoApi: typeof main = main
