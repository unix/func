import type arg from 'arg'

export type UserArg = arg.Result<any>

export type UserInputs = string[]

export type UserOptionValue = boolean | string | number | string[] | undefined
export type UserOptionEnumValue = boolean | string | number

export interface UserOption {
  [key: string]: UserOptionValue
}

export type CommandClass = new (
  inputs?: string[],
  option?: object,
  args?: UserArg,
) => any

export interface CommandParams {
  name: string
  alias?: string
  description?: string
}

export type OptionType =
  | BooleanConstructor
  | StringConstructor
  | NumberConstructor
  | [StringConstructor]
  | ArrayConstructor

export interface OptionParams {
  name: string
  type?: OptionType
  description?: string
  alias?: string
}

export type FieldOptionKind = 'array' | 'flag' | 'value'

export interface FieldOptionParams extends OptionParams {
  enum?: UserOptionEnumValue[]
  dependsOn?: string[]
  exclusive?: string[]
  propertyKey: string
  kind: FieldOptionKind
  required?: boolean
}

export interface FieldOptionDecoratorParams {
  name?: string
  description?: string
  alias?: string
}

export interface ValueDecoratorParams extends FieldOptionDecoratorParams {
  type?: OptionType
  required?: boolean
}

export interface HandlerParams {
  flag?: string
  alias?: string
  description?: string
  path?: string[]
  methodName: string
}

export interface HandlerDecoratorParams {
  flag?: string
  alias?: string
  description?: string
  path?: string[]
}

export interface FuncArgs {
  command?: RegisterCommandParams
  handler?: HandlerParams
  inputs: UserInputs
  native: UserArg
  option: UserOption
  path: string[]
}

export type ValueValidatorResult = boolean | string | void | undefined
export type ValueValidator = (value: UserOptionValue, options: UserOption) => ValueValidatorResult

export interface RegisterCommandParams extends CommandParams {
  fieldOptions?: FieldOptionParams[]
  handlers?: HandlerParams[]
  subOptions?: OptionParams[]
}
