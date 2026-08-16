import type { Deprecation } from '../../deprecation'

export interface HelpCommandMeta {
  readonly aliases: readonly string[]
  readonly deprecated?: Deprecation
  readonly description?: string
  readonly name: string
  readonly path: readonly string[]
}

export interface HelpMeta {
  readonly commands: readonly HelpCommandMeta[]
  readonly deprecated?: Deprecation
  readonly description?: string
  readonly options: readonly HelpOptionMeta[]
  readonly path: readonly string[]
  readonly title: string
  readonly usage: readonly HelpUsageMeta[]
}

export type HelpOptionKind = 'action' | 'array' | 'flag' | 'value'

export type HelpChoice = boolean | number | string

export interface HelpOptionMeta {
  readonly aliases: readonly string[]
  readonly choices?: readonly HelpChoice[]
  readonly deprecated?: Deprecation
  readonly dependsOn?: readonly string[]
  readonly description?: string
  readonly exclusive?: readonly string[]
  readonly kind: HelpOptionKind
  readonly name: string
  readonly negatable: boolean
  readonly required: boolean
  readonly type: HelpValueType
}

export interface HelpUsageMeta {
  readonly command: boolean
  readonly inputs: boolean
  readonly options: boolean
  readonly path: readonly string[]
}

export type HelpValueType = 'boolean' | 'number' | 'number[]' | 'string' | 'string[]'
