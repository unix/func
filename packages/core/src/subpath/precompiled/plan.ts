import type { ArgOption } from '../../argv/interfaces'
import type { CommandInfo } from '../../commands/command-info'
import type { HandlerParams } from '../../commands/types'
import type { handlers } from '../../commands/metadata'
import type { SpecialCommandKind } from '../../commands/graph/model'
import type { CommandParams } from '../../commands/types'
import type { CompiledFieldOption } from '../../options/field-metadata'
import type { OptionCommandParams, OptionParams } from '../../options/types'
import type { Type } from '../../di/types'
import type { ExplicitProvider, ProviderToken } from '../../di/types'
import type { ModuleInput } from '../../application/definition'

export const PRECOMPILED_APPLICATION_ABI = 2 as const

export interface PrecompiledApplicationPlan {
  readonly abi: typeof PRECOMPILED_APPLICATION_ABI
  readonly commands: readonly CommandInfo[]
  readonly handlers: readonly PrecompiledHandlerPlan[]
  readonly modules: readonly PrecompiledModulePlan[]
  readonly nodes: readonly PrecompiledCommandNodePlan[]
  readonly options: readonly PrecompiledModuleOptionPlan[]
  readonly providers: readonly PrecompiledProviderPlan[]
  readonly rootModule: number
  readonly rootNode: number
  readonly specialNodes: readonly PrecompiledSpecialNodesPlan[]
  readonly specialRoots: readonly PrecompiledSpecialRootPlan[]
}

export interface PrecompiledProviderPlan {
  readonly definition: ExplicitProvider
  readonly kind: 'option' | 'provider'
  readonly owner: number
  readonly token: ProviderToken
}

export interface PrecompiledModulePlan {
  readonly exports: readonly PrecompiledExportPlan[]
  readonly imports: readonly number[]
  readonly input: ModuleInput
  readonly multiProviders: readonly PrecompiledMultiProviderPlan[]
  readonly name: string
  readonly options: readonly number[]
  readonly providers: readonly number[]
}

export interface PrecompiledExportPlan {
  readonly multiple: boolean
  readonly records: readonly number[]
  readonly token: ProviderToken
}

export interface PrecompiledMultiProviderPlan {
  readonly records: readonly number[]
  readonly token: ProviderToken
}

export interface PrecompiledHandlerPlan {
  readonly command?: CommandParams
  readonly fieldOptions: readonly CompiledFieldOption[]
  readonly handler: Type
  readonly kind?: handlers
  readonly methodHandlers: readonly HandlerParams[]
  readonly owner: number
}

interface PrecompiledModuleOptionBase {
  readonly owner: number
  readonly record: number
  readonly target: Type
}

export interface PrecompiledOptionProviderPlan extends PrecompiledModuleOptionBase {
  readonly fieldOptions: readonly CompiledFieldOption[]
  readonly kind: 'value'
}

export interface PrecompiledOptionCommandPlan extends PrecompiledModuleOptionBase {
  readonly handler: HandlerParams
  readonly kind: 'action'
  readonly option: OptionCommandParams
}

export type PrecompiledModuleOptionPlan =
  PrecompiledOptionCommandPlan | PrecompiledOptionProviderPlan

export interface PrecompiledCommandNodePlan {
  readonly endpoint?: PrecompiledCommandEndpointPlan
  readonly optionPlan: PrecompiledOptionPlan
  readonly path: readonly string[]
  readonly transitions: readonly (readonly [string, number])[]
}

export interface PrecompiledCommandEndpointPlan {
  readonly command?: CommandInfo
  readonly handler: number
  readonly method: number
  readonly path: readonly string[]
}

export type PrecompiledActionPlan =
  PrecompiledFlagActionPlan | PrecompiledOptionActionPlan

export interface PrecompiledFlagActionPlan {
  readonly handler: number
  readonly kind: 'command'
  readonly method: number
  readonly option: OptionParams
  readonly path: readonly string[]
}

export interface PrecompiledOptionActionPlan {
  readonly declaration: number
  readonly kind: 'option-command'
  readonly path: readonly string[]
}

export interface PrecompiledArgvPlan {
  readonly options: readonly ArgOption[]
  readonly tokens: readonly PrecompiledArgTokenPlan[]
}

export interface PrecompiledArgTokenPlan {
  readonly booleanValue?: boolean
  readonly option: number
  readonly token: string
}

export interface PrecompiledFieldBindingPlan {
  readonly fields: readonly number[]
  readonly target: number
}

export interface PrecompiledOptionPlan {
  readonly actions: readonly PrecompiledActionPlan[]
  readonly argvPlan: PrecompiledArgvPlan
  readonly commandBindings: readonly PrecompiledFieldBindingPlan[]
  readonly commandOptionNames: readonly PrecompiledOptionNamesPlan[]
  readonly commonOptionNames: readonly string[]
  readonly commonOptions: readonly OptionParams[]
  readonly owner: number
  readonly providerBindings: readonly PrecompiledFieldBindingPlan[]
  readonly providers: readonly number[]
}

export interface PrecompiledOptionNamesPlan {
  readonly names: readonly string[]
  readonly target: number
}

export interface PrecompiledSpecialNodesPlan {
  readonly kind: SpecialCommandKind
  readonly nodes: readonly number[]
}

export interface PrecompiledSpecialRootPlan {
  readonly kind: SpecialCommandKind
  readonly node: number
}
