import type arg from 'arg'

export type UserArg = arg.Result<any>

export type UserInputs = string[]

export type UserOptionValue = boolean | string | number | string[] | undefined

export interface UserOption {
  [key: string]: UserOptionValue
}

export type CommandClass = new (
  inputs?: string[],
  option?: object,
  args?: UserArg,
) => any

export type OptionClass = new (value?: UserOptionValue, args?: UserArg) => any

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

export interface RegisterCommandParams extends CommandParams {
  subOptions?: OptionParams[]
}
