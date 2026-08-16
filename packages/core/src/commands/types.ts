import type { Deprecation } from '../deprecation'
import type { FieldOptionParams } from '../options/types'

interface AliasDecoratorParams {
  alias?: string
  aliases?: readonly string[]
}

export type CommandPath = string | readonly string[]

export interface CommandDecoratorParams extends AliasDecoratorParams {
  path: CommandPath
  deprecated?: Deprecation
  description?: string
}

export type CommandDecoratorInput = CommandPath | CommandDecoratorParams

export interface CommandParams {
  aliases: readonly string[]
  path: string[]
  deprecated?: Deprecation
  description?: string
}

export interface HandlerParams {
  aliases: readonly string[]
  flag?: string
  deprecated?: Deprecation
  description?: string
  path: string[]
  methodName: string
}

export type HandlerPath = '' | CommandPath

export interface PathHandlerDecoratorParams {
  alias?: never
  aliases?: never
  description?: string
  flag?: never
  path?: HandlerPath
}

export interface FlagHandlerDecoratorParams extends AliasDecoratorParams {
  description?: string
  flag: string
  path?: never
}

export type HandlerDecoratorParams =
  PathHandlerDecoratorParams | FlagHandlerDecoratorParams

export type HandlerDecoratorInput = HandlerPath | HandlerDecoratorParams

export interface RegisterCommandParams {
  aliases: readonly string[]
  deprecated?: Deprecation
  description?: string
  fieldOptions?: FieldOptionParams[]
  path: string[]
}
