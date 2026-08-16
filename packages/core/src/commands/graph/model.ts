import type { ArgPlan } from '../../arg'
import type { CommandInfo } from '../command-info'
import type { CompiledModule } from '../../di/module-compiler'
import type { HandlerParams } from '../types'
import type { OptionParams } from '../../options/types'
import type {
  CompiledModuleOption,
  CompiledModuleOptions,
  CompiledOptionCommand,
  CompiledOptionProvider,
} from '../../options/compiler'
import type { CompiledFieldOption } from '../../options/field-metadata'
import type { handlers } from '../metadata'
import type { HandlerRecord, HandlerRegistry } from './registry'

interface CommandEndpointBase<Handler extends HandlerParams = HandlerParams> {
  handler: Handler
  kind: 'command'
  path: readonly string[]
  record: HandlerRecord
}

interface NamedCommandEndpoint<
  Handler extends HandlerParams = HandlerParams,
> extends CommandEndpointBase<Handler> {
  command: CommandInfo
}

interface SpecialCommandEndpoint<
  Handler extends HandlerParams = HandlerParams,
> extends CommandEndpointBase<Handler> {
  command?: never
}

export type CommandEndpoint<Handler extends HandlerParams = HandlerParams> =
  NamedCommandEndpoint<Handler> | SpecialCommandEndpoint<Handler>

export type FlagHandlerParams = HandlerParams & { flag: string }

export type NamedEndpoint<Handler extends HandlerParams = HandlerParams> =
  NamedCommandEndpoint<Handler>

export type SpecialEndpoint<Handler extends HandlerParams = HandlerParams> =
  SpecialCommandEndpoint<Handler>

export type FlagCommandEndpoint = CommandEndpoint<FlagHandlerParams> & {
  option: OptionParams
}

export interface OptionCommandEndpoint {
  declaration: CompiledOptionCommand
  handler: HandlerParams
  kind: 'option-command'
  option: OptionParams
  owner: CompiledModule
  path: readonly string[]
}

export type ActionEndpoint = FlagCommandEndpoint | OptionCommandEndpoint

export interface ProviderOptionBinding {
  fieldOptions: readonly CompiledFieldOption[]
  provider: CompiledOptionProvider
}

export interface OptionPlan {
  readonly actions: readonly ActionEndpoint[]
  readonly argPlan: ArgPlan
  readonly commandBindings: ReadonlyMap<
    HandlerRecord,
    readonly CompiledFieldOption[]
  >
  readonly commandOptionNames: ReadonlyMap<HandlerRecord, ReadonlySet<string>>
  readonly commonOptionNames: ReadonlySet<string>
  readonly commonOptions: readonly OptionParams[]
  readonly owner: CompiledModule
  readonly providerBindings: readonly ProviderOptionBinding[]
  readonly providers: readonly CompiledModuleOption[]
}

export interface CommandNode {
  readonly endpoint?: CommandEndpoint
  readonly optionPlan: OptionPlan
  readonly path: readonly string[]
  readonly transitions: ReadonlyMap<string, CommandNode>
}

export interface CommandMatch {
  consumed: number
  invokedPath: readonly string[]
  node: CommandNode
}

export interface MutableCommandNode {
  children: Map<string, MutableCommandNode>
  endpoint?: CommandEndpoint
  flagEndpoints: Map<string, FlagCommandEndpoint>
  path: string[]
  scopeRecords: Set<HandlerRecord>
  tokenOwners: Map<string, string>
  tokens: Map<string, MutableCommandNode>
}

export interface CompiledCommandGraph {
  commandInfos: readonly CommandInfo[]
  nodes: readonly CommandNode[]
  root: CommandNode
  specialNodes: ReadonlyMap<SpecialCommandKind, readonly CommandNode[]>
  specialRoots: ReadonlyMap<SpecialCommandKind, CommandNode>
}

export interface CommandGraphParams {
  options: CompiledModuleOptions
  registry: HandlerRegistry
  root: CompiledModule
}

export type SpecialCommandKind = handlers.MAJOR | handlers.MISSING
