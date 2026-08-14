import 'reflect-metadata/lite'

export { Command, CommandMajor, CommandMissing, Handler } from './commands'

export { Deprecated } from './deprecation'

export { Args, Inject } from './injection'

export {
  ArrayValue,
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

export { Module, Injectable, createApp, createToken, run } from './application'

export { Container } from './containers/container'
export type { ContainerOptions, InvocationResult } from './containers/container'
export type {
  ArrayValueDecoratorParams,
  CommandDecoratorInput,
  CommandDecoratorParams,
  CommandPath,
  Deprecation,
  HandlerDecoratorInput,
  HandlerDecoratorParams,
  HandlerPath,
  OptionCommandDecoratorParams,
  FieldOptionDecoratorParams,
  FlagDecoratorParams,
  ValueDecoratorParams,
  ValueOptionType,
} from './interfaces'
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
export { Context, ExceptionContext } from './context'
export type { CommandInfo, ContextIO } from './context'
