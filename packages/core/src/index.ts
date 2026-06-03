import 'reflect-metadata'

export {
  Catch,
  CatchAll,
  Command,
  CommandError,
  CommandMajor,
  CommandMissing,
  Handler,
  SubOptions,
} from './commands'

export {
  Args,
  Exception,
  Regs,
} from './injection'

export {
  ArrayValue,
  DependsOn,
  Enum,
  Exclusive,
  Flag,
  Required,
  Value,
  ValueValidate,
} from './options'

export {
  FuncModule,
  Service,
  createApp,
  run,
} from './application'

export type { FuncArgs } from './interfaces'

export { Container } from './containers/container'
export type { ContainerOptions, ContainerParams } from './containers/container'
export type { FuncModuleInput, FuncModuleParams } from './application'

export * from './errors'
export * from './context'
