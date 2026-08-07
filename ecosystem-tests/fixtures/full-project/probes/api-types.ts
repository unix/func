import type {
  ContainerOptions,
  ContainerParams,
  FuncArgs,
  FuncErrorCode,
  FuncErrorDetails,
  FuncErrorParams,
  FuncModuleInput,
  FuncModuleParams,
} from 'func'
import { main } from 'funcgo'

export type PublishedFuncTypes = [
  ContainerOptions,
  ContainerParams,
  FuncArgs,
  FuncErrorCode,
  FuncErrorDetails,
  FuncErrorParams,
  FuncModuleInput,
  FuncModuleParams,
]

export const publishedFuncgoApi: typeof main = main
