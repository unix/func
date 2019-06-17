import arg from 'arg'

export type UserInputs = string[]

export type UserOption = any

export type UserArg = arg.Result<any>

export type CommandClass = new (
  inputs?: string[],
  option?: object,
  args?: arg.Result<any>,
) => void

export type OptionClass = new (
  value?: any,
  args?: arg.Result<any>,
) => void

export interface CommandParams {
  name: string
  alias?: string
  description?: string
}

export type OptionType = BooleanConstructor | StringConstructor | NumberConstructor | ArrayConstructor

export interface OptionParams {
  name: string
  type?: OptionType
  description?: string
  alias?: string
}
