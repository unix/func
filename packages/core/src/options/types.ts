import type { Deprecation } from '../deprecation'

export type UserOptionValue =
  boolean | string | number | string[] | number[] | undefined

export type UserOptionEnumValue = boolean | string | number

export interface UserOption {
  [key: string]: UserOptionValue
}

interface AliasDecoratorParams {
  alias?: string
  aliases?: readonly string[]
}

export type ValueOptionType = StringConstructor | NumberConstructor

export type ParserOptionType =
  BooleanConstructor | ValueOptionType | [ValueOptionType]

export interface OptionParams {
  aliases: readonly string[]
  name: string
  type: ParserOptionType
  deprecated?: Deprecation
  description?: string
  negatable?: boolean
}

export interface OptionCommandDecoratorParams extends AliasDecoratorParams {
  deprecated?: Deprecation
  description?: string
  name: string
  overrideAll?: boolean
}

export type OptionCommandParams = Omit<OptionParams, 'negatable' | 'type'> & {
  overrideAll?: boolean
  type: BooleanConstructor
}

export type FieldOptionKind = 'array' | 'flag' | 'value'

interface FieldOptionBaseParams extends Omit<OptionParams, 'negatable' | 'type'> {
  enum?: UserOptionEnumValue[]
  dependsOn?: string[]
  exclusive?: string[]
  propertyKey: string
  required?: boolean
}

export type FieldOptionParams<Kind extends FieldOptionKind = FieldOptionKind> =
  Kind extends FieldOptionKind
    ? FieldOptionBaseParams & {
        kind: Kind
        type: Kind extends 'array'
          ? [ValueOptionType]
          : Kind extends 'flag'
            ? BooleanConstructor
            : ValueOptionType
      } & (Kind extends 'flag' ? { negatable?: boolean } : { negatable?: never })
    : never

export type CompiledFieldOptionParams<
  Kind extends FieldOptionKind = FieldOptionKind,
> = FieldOptionParams<Kind> & {
  override?: boolean
}

export interface FieldOptionDecoratorParams extends AliasDecoratorParams {
  name?: string
  description?: string
}

export type ArrayNumberDecoratorParams = FieldOptionDecoratorParams

export type ArrayStringDecoratorParams = FieldOptionDecoratorParams

export interface FlagDecoratorParams extends FieldOptionDecoratorParams {
  negatable?: boolean
}

export type ValueDecoratorParams = FieldOptionDecoratorParams

export type ValueValidatorResult = boolean | string | void | undefined

export type ValueValidator = (
  value: UserOptionValue,
  options: UserOption,
) => ValueValidatorResult
