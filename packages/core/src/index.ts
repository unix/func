import 'reflect-metadata/lite'

export { Command, CommandMajor, CommandMissing, Handler } from './commands'

export { Deprecated } from './deprecation'

export { Args, Ctx, Inject, Stderr, Stdin, Stdout } from './runtime/injection'
export {
  APP_FILTER,
  APP_INTERCEPTOR,
  Catch,
  MODULE_FILTER,
  MODULE_INTERCEPTOR,
  MODULE_OPTION,
  UseFilters,
  UseInterceptors,
} from './runtime/enhancers'
export type {
  CallHandler,
  ExceptionFilter,
  ExceptionMatcher,
  Interceptor,
} from './runtime/enhancers'
export { OutputHost } from './runtime/output'
export type { OutputChannel, OutputScope } from './runtime/output'

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
  createValueDecorator,
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
  ArrayNumberDecoratorInput,
  ArrayNumberDecoratorParams,
  ArrayStringDecoratorInput,
  ArrayStringDecoratorParams,
  OptionCommandDecoratorParams,
  FieldOptionDecoratorParams,
  FlagDecoratorInput,
  FlagDecoratorParams,
  ValueDecoratorInput,
  ValueDecorator,
  ValueDecoratorParams,
  ValueOptionType,
  ValueTransform,
} from './options/types'
export type {
  ClassProvider,
  FactoryProvider,
  ModuleMetadata,
  InjectionToken,
  OnDispose,
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
} from './shared/errors'
export { Context } from './runtime/context'
export type { CommandInfo } from './commands/command-info'
export type { ContextIO } from './runtime/context'
