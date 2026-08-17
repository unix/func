import type { ParsedUserOption } from '../options/types'

export type ArgValueType = 'boolean' | 'number' | 'string'

export interface ArgOption {
  readonly multiple: boolean
  readonly name: string
  readonly type: ArgValueType
}

export interface ArgToken {
  readonly booleanValue?: boolean
  readonly option: ArgOption
}

export interface ArgvPlan {
  readonly options: readonly ArgOption[]
  readonly tokens: ReadonlyMap<string, ArgToken>
}

export interface ArgParseFailure {
  readonly details: Record<string, unknown>
  readonly message: string
}

export type ArgParseResult =
  | { readonly parsed: ParsedArgv; readonly success: true }
  | { readonly failure: ArgParseFailure; readonly success: false }

export interface ParsedArgv {
  readonly options: ParsedUserOption
  readonly positionals: readonly string[]
  readonly supplied: ReadonlySet<string>
  readonly unknown: readonly string[]
}
