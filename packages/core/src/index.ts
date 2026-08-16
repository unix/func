import 'reflect-metadata/lite'

export { Command, CommandMajor, CommandMissing, Handler } from './commands'

export { Deprecated } from './deprecation'

export { Args, Ctx, Inject, Stderr, Stdout } from './runtime/injection'

export {
  ArrayNumber,
  ArrayString,
  DependsOn,
  Enum,
  Exclusive,
  Flag,
  Option,
  OptionCommand,
  Override,
  Required,
  Value,
  ValueValidate,
} from './options'

export { Module, Injectable, createApp, createToken } from './application'
export type {
  App,
  AppOptions,
  ApplicationFeature,
  BootstrapOptions,
} from './application'
export type {
  CommandDecoratorInput,
  CommandDecoratorParams,
  CommandPath,
  HandlerDecoratorInput,
  HandlerDecoratorParams,
  HandlerPath,
} from './commands/types'
export type { Deprecation } from './deprecation'
export type {
  ArrayNumberDecoratorParams,
  ArrayStringDecoratorParams,
  OptionCommandDecoratorParams,
  FieldOptionDecoratorParams,
  FlagDecoratorParams,
  ValueDecoratorParams,
  ValueOptionType,
} from './options/types'
export type {
  ClassProvider,
  FactoryProvider,
  ExecutionOutcome,
  ModuleMetadata,
  InjectionToken,
  OnDispose,
  OnError,
  OnInit,
  Provider,
  ProviderToken,
  Type,
  ValueProvider,
} from './application'

export {
  ErrorScope,
  Exception,
  formatExceptionCode,
  isException,
} from './shared/errors'
export type {
  ExceptionCode,
  ExceptionDetails,
  ExceptionOptions,
  SerializedException,
} from './shared/errors'
export { Context, ExceptionContext } from './runtime/context'
export type { CommandInfo } from './commands/command-info'
export type { ContextIO } from './runtime/context'
