// import type { Handler, Spec } from 'arg'

type Handler<T = any> = (value: string, name: string, previousValue?: T) => T
interface Spec {
  [key: string]: string | Handler | [Handler]
}
type ArgResult<T extends Spec> = { _: string[] } & {
  [K in keyof T]?: T[K] extends Handler
    ? ReturnType<T[K]>
    : T[K] extends [Handler]
    ? Array<ReturnType<T[K][0]>>
    : never
}

export type UserInputs = string[]

export type UserOption = any

export type UserArg = ArgResult<any>

export type CommandClass = new (
  inputs?: string[],
  option?: object,
  args?: ArgResult<any>,
) => void

export type OptionClass = new (value?: any, args?: ArgResult<any>) => void

export interface CommandParams {
  name: string
  alias?: string
  description?: string
}

export type OptionType =
  | BooleanConstructor
  | StringConstructor
  | NumberConstructor
  | ArrayConstructor
  | [StringConstructor]

export interface OptionParams {
  name: string
  type?: OptionType
  description?: string
  alias?: string
}

export interface RegisterCommandParams extends CommandParams {
  subOptions?: OptionParams[]
}
