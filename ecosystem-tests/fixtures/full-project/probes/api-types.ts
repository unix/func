import type {
  ArrayNumberDecoratorParams,
  ArrayStringDecoratorParams,
  BootstrapOptions,
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
  BootstrapOptions,
  Deprecation,
  Args,
  ExceptionCode,
  ExceptionDetails,
  ExceptionOptions,
  ModuleMetadata,
]

export const publishedFuncgoApi: typeof main = main
