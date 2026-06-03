import arg from 'arg'
import * as filter from './filter'
import { metadata } from './metadata'
import {
  CommandClass,
  FuncArgs,
  HandlerParams,
  RegisterCommandParams,
  UserOption,
} from '../interfaces'
import { ServiceInjector } from '../application/injector'
import type { ServiceClass } from '../application/interfaces'
import { injectTokens } from '../injection'
import {
  FuncException,
  CommandRegistry,
} from '../context'

export interface FactoryParams {
  args: arg.Result<any>
  nativeOption: UserOption
  commands: CommandClass[]
  command?: RegisterCommandParams
  handler?: HandlerParams
  inputs?: string[]
  path?: string[]
  services?: ServiceClass[]
}

export class Factory {
  private injector: ServiceInjector

  constructor(private params: FactoryParams) {
    this.injector = new ServiceInjector(params.services)
  }

  getServiceParams(target: Function, error?: Error | FuncException): any[] {
    return this.resolveServiceParams(target, undefined, error, [])
  }

  getMethodServiceParams(
    instance: object,
    methodName: string,
    error?: Error | FuncException,
  ): any[] {
    const target = Object.getPrototypeOf(instance)

    return this.resolveServiceParams(target, methodName, error, [])
  }

  private resolveServiceParams(
    target: Object | Function,
    propertyKey?: string,
    error?: Error | FuncException,
    serviceStack: ServiceClass[] = [],
  ): any[] {
    const injectedTokens = this.injectedTokens(target, propertyKey)
    const paramTypes = this.paramTypes(target, propertyKey)
    const args = this.params.args
    const option = this.params.nativeOption
    const inputs = this.params.inputs || args._
    const length = Math.max(
      paramTypes.length,
      0,
      ...Object.keys(injectedTokens).map(item => Number(item) + 1),
    )

    return Array.from({ length }).map((_, index) => {
      const token = injectedTokens[index]
      if (token) return this.resolveInjectedToken(token, inputs, option, args, error)

      return this.resolveService(paramTypes[index], error, serviceStack)
    })
  }

  private injectedTokens(
    target: Object | Function,
    propertyKey?: string,
  ): Record<number, injectTokens> {
    if (propertyKey) {
      return Reflect.getMetadata(
        metadata.PARAM_INJECT_TOKEN_IDENTIFIER,
        target,
        propertyKey,
      ) || {}
    }

    return Reflect.getMetadata(metadata.PARAM_INJECT_TOKEN_IDENTIFIER, target) || {}
  }

  private paramTypes(
    target: Object | Function,
    propertyKey?: string,
  ): ServiceClass[] {
    if (propertyKey) {
      return Reflect.getMetadata(metadata.DESIGN_PARAM_TYPES, target, propertyKey) || []
    }

    return Reflect.getMetadata(metadata.DESIGN_PARAM_TYPES, target) || []
  }

  private resolveService(
    target: ServiceClass | undefined,
    error?: Error | FuncException,
    serviceStack: ServiceClass[] = [],
  ) {
    return this.injector.resolve(
      target,
      (service, nextStack) => this.resolveServiceParams(
        service,
        undefined,
        error,
        nextStack,
      ),
      serviceStack,
    )
  }

  private resolveInjectedToken(
    token: injectTokens,
    inputs: string[],
    option: UserOption,
    args: arg.Result<any>,
    error?: Error | FuncException,
  ) {
    if (token === injectTokens.ARGS) {
      return {
        command: this.params.command,
        handler: this.params.handler,
        inputs,
        native: args,
        option,
        path: this.params.path || [],
      } as FuncArgs
    }

    if (token === injectTokens.EXCEPTION) {
      if (error instanceof FuncException) return error
      return new FuncException(error as any)
    }

    if (token === injectTokens.REGS) {
      const commands = filter.commandsToDatas(this.params.commands)

      return new CommandRegistry(commands)
    }

    return undefined
  }
}
