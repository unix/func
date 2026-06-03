import type { ContainerParams } from '../containers/container'

export type ServiceClass = new (...args: any[]) => any

export interface FuncModuleParams {
  commands?: ContainerParams
  imports?: FuncModuleInput[]
  services?: ServiceClass[]
}

export type FuncModuleInput = FuncModuleParams | (new (...args: any[]) => any)

export interface ResolvedModule {
  commands: ContainerParams
  services: ServiceClass[]
}
