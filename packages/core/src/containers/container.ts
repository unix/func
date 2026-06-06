import arg from 'arg'
import { Factory } from '../utils/factory'
import * as filter from '../utils/filter'
import {
  CommandClass,
  FieldOptionParams,
  HandlerParams,
  OptionParams,
  RegisterCommandParams,
  UserOption,
  ValueValidator,
} from '../interfaces'
import type { ServiceClass } from '../application/interfaces'
import { metadata, handlers } from '../utils/metadata'
import {
  F_RUNTIME_PRINT,
  F_SYSTEM,
  errorLevels,
  errorTypes,
  createRuntimePrintError,
  createSystemError,
  handleRuntimePrintError,
  handleSystemError,
  isFuncError,
  normalizeRuntimeError,
} from '../errors'
import { FuncException } from '../context'
import { ConstraintValidator } from '../options/constraint-validator'
import type { CatchParams } from '../commands/catch'
import { HandlerRegistry } from './handler-registry'
import { RegistrationValidator } from './registration-validator'

export type ContainerParams = Array<new (...args: any[]) => any>
export interface ContainerData {
  [key: string]: ContainerParams
}

export interface ContainerOptions {
  argv?: string[]
  services?: ServiceClass[]
}

interface Scope {
  handler: CommandClass
  kind: handlers.COMMAND | handlers.MAJOR | handlers.MISSING
}

interface SelectedHandler {
  data: HandlerParams
  inputs: string[]
  path: string[]
}

export class Container {
  private argv: string[]
  private registry: HandlerRegistry
  private services: ServiceClass[]
  datas: ContainerData

  constructor(params: ContainerParams, options: ContainerOptions = {}) {
    this.argv = options.argv || process.argv.slice(2)
    this.registry = new HandlerRegistry(params)
    this.services = options.services || []
    this.datas = this.registry.datas
    new RegistrationValidator(this.registry).validate()
  }

  async run(): Promise<void> {
    try {
      await this.dispatch()
    } catch (error) {
      this.dispatchError(error)
    }
  }

  private async dispatch() {
    const scope = this.scope()
    if (!scope) return
    if (
      scope.kind === handlers.MISSING &&
      !this.methodHandlers(scope.handler).length
    ) {
      this.dispatchLegacyMissing(scope.handler)
      return
    }

    const spec = this.optionSpec(scope.handler)
    const args = this.parse(spec)
    this.throwUnknownOptions(args, scope.kind === handlers.COMMAND)

    const nativeOption = this.nativeOption(spec, args)
    const commandData = this.commandData(scope.handler)
    const baseInputs = scope.kind === handlers.COMMAND ? args._.slice(1) : args._
    const selectedHandler = this.selectHandler(scope.handler, args, baseInputs)
    const factory = new Factory({
      nativeOption,
      args,
      command: commandData,
      commands: this.registry.commands(),
      handler: selectedHandler.data,
      inputs: selectedHandler.inputs,
      path: selectedHandler.path,
      services: this.services,
    })
    const constructorParams = factory.getServiceParams(scope.handler)
    const instance = new scope.handler(...constructorParams)

    try {
      this.injectFields(scope.handler, instance, args, nativeOption)
      this.validateFieldValues(scope.handler, nativeOption)
      new ConstraintValidator(
        this.fieldOptions(scope.handler),
        args,
        nativeOption,
      ).validate()

      const methodParams = factory.getMethodServiceParams(
        instance,
        selectedHandler.data.methodName,
      )

      await Promise.resolve(
        instance[selectedHandler.data.methodName](...methodParams),
      )
    } catch (error) {
      const caught = await this.dispatchLocalCatch(
        scope.handler,
        instance,
        error,
        factory,
      )
      if (caught) return

      throw error
    }
  }

  private scope(): Scope | undefined {
    const command = this.findCommand()
    if (command) return { handler: command, kind: handlers.COMMAND }

    if (this.argv[0] && !this.argv[0].startsWith('-')) {
      const missing = this.registry.missing()[0]
      if (missing) return { handler: missing, kind: handlers.MISSING }

      return undefined
    }

    const major = this.registry.major()
    if (major) return { handler: major, kind: handlers.MAJOR }

    if (this.argv.some(item => item.startsWith('-') && item !== '-')) {
      throw createRuntimePrintError(
        F_RUNTIME_PRINT.UNKNOWN_OPTION,
        errorTypes.INPUT,
        `Unknown option${this.argv.length > 1 ? 's' : ''}: ${this.argv.join(', ')}.`,
        { options: this.argv },
      )
    }

    return undefined
  }

  private dispatchLegacyMissing(missing: CommandClass) {
    const args = { _: this.argv } as arg.Result<any>
    const factory = new Factory({
      nativeOption: {},
      args,
      commands: this.registry.commands(),
      inputs: this.argv,
      services: this.services,
    })
    const params = factory.getServiceParams(missing)
    new missing(...params)
  }

  private parse(spec: arg.Spec): arg.Result<any> {
    try {
      return arg(spec, { argv: this.argv, permissive: true })
    } catch (error) {
      throw createRuntimePrintError(
        F_RUNTIME_PRINT.PARSE,
        errorTypes.INPUT,
        error instanceof Error ? error.message : String(error),
        { error },
        error instanceof Error ? error : undefined,
      )
    }
  }

  private nativeOption(spec: arg.Spec, args: arg.Result<any>): UserOption {
    return Object.keys(spec).reduce<UserOption>((pre, key) => {
      if (!key.startsWith('--')) return pre

      return Object.assign({}, pre, {
        [filter.removeHyphen(key)]: Object.prototype.hasOwnProperty.call(args, key)
          ? args[key]
          : undefined,
      })
    }, {})
  }

  private injectFields(
    handler: CommandClass,
    instance: any,
    args: arg.Result<any>,
    nativeOption: UserOption,
  ) {
    this.fieldOptions(handler).forEach(data => {
      const key = `--${data.name}`
      const hasValue = Object.prototype.hasOwnProperty.call(args, key)
      const value = hasValue ? args[key] : instance[data.propertyKey]
      if (data.required && value === undefined) {
        throw createRuntimePrintError(
          F_RUNTIME_PRINT.VALIDATION,
          errorTypes.INPUT,
          `Option "--${data.name}" is required.`,
          { option: data.name },
        )
      }

      instance[data.propertyKey] = value
      nativeOption[data.name] = value
    })
  }

  private validateFieldValues(handler: CommandClass, nativeOption: UserOption) {
    const validators: Record<string, ValueValidator[]> =
      Reflect.getMetadata(metadata.VALUE_VALIDATOR_IDENTIFIER, handler) || {}
    this.fieldOptions(handler).forEach(data => {
      const fns = validators[data.propertyKey] || []
      fns.forEach(fn => {
        try {
          const result = fn(nativeOption[data.name], nativeOption)
          if (result === false || typeof result === 'string') {
            throw createRuntimePrintError(
              F_RUNTIME_PRINT.VALIDATION,
              errorTypes.INPUT,
              typeof result === 'string'
                ? result
                : `Option "--${data.name}" is invalid.`,
              { option: data.name, value: nativeOption[data.name] },
            )
          }
        } catch (error) {
          if (isFuncError(error)) throw error

          throw createRuntimePrintError(
            F_RUNTIME_PRINT.VALIDATION,
            errorTypes.INPUT,
            error instanceof Error ? error.message : String(error),
            { option: data.name, value: nativeOption[data.name] },
            error instanceof Error ? error : undefined,
          )
        }
      })
    })
  }

  private selectHandler(
    handler: CommandClass,
    args: arg.Result<any>,
    inputs: string[],
  ): SelectedHandler {
    const methodHandlers = this.methodHandlers(handler)
    const pathHandler = this.selectPathHandler(methodHandlers, inputs)
    if (pathHandler) return pathHandler

    const matchedHandlers = methodHandlers.filter(data => {
      if (!data.flag) return false

      return Object.prototype.hasOwnProperty.call(args, `--${data.flag}`)
    })

    if (matchedHandlers.length > 1) {
      throw createRuntimePrintError(
        F_RUNTIME_PRINT.MULTIPLE_OPTIONS,
        errorTypes.INPUT,
        `Only one handler flag can be invoked at a time: ${matchedHandlers
          .map(item => `--${item.flag}`)
          .join(', ')}.`,
        { options: matchedHandlers.map(item => item.flag) },
      )
    }

    const selectedHandler =
      matchedHandlers[0] || methodHandlers.find(data => !data.flag)
    if (selectedHandler) {
      return {
        data: selectedHandler,
        inputs,
        path: [],
      }
    }

    throw createSystemError(
      F_SYSTEM.MISSING_HANDLER,
      errorTypes.REGISTRATION,
      `Command "${handler.name}" does not have a matching @Handler method.`,
      { handler: handler.name },
    )
  }

  private optionSpec(handler: CommandClass): arg.Spec {
    const fieldOptions = this.fieldOptions(handler)
    const handlerOptions = this.methodHandlers(handler)
      .filter(item => item.flag)
      .map<OptionParams>(item => ({
        name: item.flag || '',
        alias: item.alias,
        description: item.description,
        type: Boolean,
      }))

    const options: OptionParams[] = [
      ...fieldOptions,
      ...handlerOptions,
      ...this.subOptions(handler),
    ]

    return filter.optionsToKeyValue(options)
  }

  private fieldOptions(handler: CommandClass): FieldOptionParams[] {
    return Reflect.getMetadata(metadata.FIELD_OPTION_IDENTIFIER, handler) || []
  }

  private commandData(handler: CommandClass): RegisterCommandParams | undefined {
    return Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, handler)
  }

  private methodHandlers(handler: CommandClass): HandlerParams[] {
    return Reflect.getMetadata(metadata.METHOD_HANDLER_IDENTIFIER, handler) || []
  }

  private selectPathHandler(
    handlers: HandlerParams[],
    inputs: string[],
  ): SelectedHandler | undefined {
    const matched = handlers
      .filter(data => data.path && data.path.length)
      .filter(data => data.path!.every((item, index) => inputs[index] === item))
      .sort((a, b) => b.path!.length - a.path!.length)[0]
    if (!matched) return undefined

    return {
      data: matched,
      inputs: inputs.slice(matched.path!.length),
      path: matched.path || [],
    }
  }

  private subOptions(handler: CommandClass): OptionParams[] {
    return Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, handler) || []
  }

  private findCommand(): CommandClass | undefined {
    const first = this.argv[0]
    if (!first || first.startsWith('-')) return undefined

    return this.registry.findCommand(first)
  }

  private throwUnknownOptions(args: arg.Result<any>, hasCommand: boolean) {
    const options = args._.filter((input, index) => {
      if (hasCommand && index === 0) return false

      return input.startsWith('-') && input !== '-'
    })
    if (!options.length) return

    throw createRuntimePrintError(
      F_RUNTIME_PRINT.UNKNOWN_OPTION,
      errorTypes.INPUT,
      `Unknown option${options.length > 1 ? 's' : ''}: ${options.join(', ')}.`,
      { options },
    )
  }

  private dispatchError(error: unknown) {
    const funcError = normalizeRuntimeError(error)
    if (funcError.level === errorLevels.SYSTEM) {
      handleSystemError(funcError)
    }

    const errors = this.registry.errors()
    if (!errors.length) {
      if (funcError.level === errorLevels.RUNTIME_PRINT) {
        handleRuntimePrintError(funcError, false)
        return
      }

      throw funcError
    }

    const factory = new Factory({
      nativeOption: {},
      args: { _: [] } as arg.Result<any>,
      commands: this.registry.commands(),
      services: this.services,
    })

    const exception = new FuncException(funcError)
    errors.forEach(errorHandler => {
      const params = factory.getServiceParams(errorHandler, exception)
      new errorHandler(...params)
    })

    if (funcError.level === errorLevels.RUNTIME_PRINT) {
      handleRuntimePrintError(funcError, exception.printPrevented)
    }
  }

  private async dispatchLocalCatch(
    handler: CommandClass,
    instance: any,
    error: unknown,
    factory: Factory,
  ): Promise<boolean> {
    const funcError = normalizeRuntimeError(error)
    if (funcError.level === errorLevels.SYSTEM) return false

    const catches: CatchParams[] =
      Reflect.getMetadata(metadata.METHOD_CATCH_IDENTIFIER, handler) || []
    if (!catches.length) return false

    await catches.reduce(async (promise, data) => {
      await promise
      const params = factory.getMethodServiceParams(
        instance,
        data.methodName,
        new FuncException(funcError),
      )
      await Promise.resolve(instance[data.methodName](...params))
    }, Promise.resolve())

    return true
  }
}
