import type {
  ArrayNumberDecoratorParams,
  ArrayStringDecoratorParams,
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
  ArrayNumberDecoratorParams,
  ArrayStringDecoratorParams,
  ContainerOptions,
  Deprecation,
  Args,
  ExceptionCode,
  ExceptionDetails,
  ExceptionOptions,
  ModuleMetadata,
]

export const publishedFuncgoApi: typeof main = main
