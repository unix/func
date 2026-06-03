import type {
  CommandClass,
  FieldOptionParams,
  HandlerParams,
  OptionParams,
} from '../interfaces'
import {
  F_SYSTEM,
  errorScopes,
  errorTokenTypes,
  errorTypes,
  createSystemError,
} from '../errors'
import { metadata } from '../utils/metadata'
import type { ContainerParams } from './container'
import { HandlerRegistry } from './handler-registry'

export class RegistrationValidator {
  constructor(private registry: HandlerRegistry) {}

  validate() {
    this.validateKnownHandlers()
    this.validateDuplicateTokens(
      this.registry.commands(),
      metadata.COMMAND_IDENTIFIER,
      data => [
        { token: data.name, type: errorTokenTypes.COMMAND_NAME },
        { token: data.alias, type: errorTokenTypes.COMMAND_ALIAS },
      ],
      errorScopes.COMMAND,
    )
    this.validateMajorCount()

    this.registry
      .commands()
      .concat(this.registry.majors())
      .forEach(handler => this.validateCommandShape(handler))
  }

  private validateKnownHandlers() {
    if (!this.registry.invalidHandlers.length) return

    const names = this.registry.invalidHandlers.map(handler => handler.name || '<anonymous>')
    throw createSystemError(
      F_SYSTEM.UNKNOWN_HANDLER,
      errorTypes.REGISTRATION,
      `All handlers passed to Container must use a func decorator: ${names.join(', ')}.`,
      { handlers: names },
    )
  }

  private validateMajorCount() {
    const majors = this.registry.majors()
    if (majors.length <= 1) return

    throw createSystemError(
      F_SYSTEM.DUPLICATE_HANDLER,
      errorTypes.REGISTRATION,
      `Only one major command can be registered: ${majors.map(item => item.name).join(', ')}.`,
      { scope: errorScopes.COMMAND, handlers: majors.map(item => item.name) },
    )
  }

  private validateDuplicateTokens(
    handlers: ContainerParams,
    ident: metadata,
    tokensFor: (data: any) => Array<{ token?: string; type: errorTokenTypes }>,
    scope: errorScopes,
  ) {
    const tokens: Record<string, string> = {}

    handlers.forEach(handler => {
      const data = Reflect.getMetadata(ident, handler)
      tokensFor(data).forEach(item => {
        if (!item.token) return
        if (tokens[item.token]) {
          throw createSystemError(
            F_SYSTEM.DUPLICATE_HANDLER,
            errorTypes.REGISTRATION,
            `Duplicate ${scope} token "${item.token}" found in "${tokens[item.token]}" and "${handler.name}".`,
            {
              scope,
              token: item.token,
              type: item.type,
              handlers: [tokens[item.token], handler.name],
            },
          )
        }

        tokens[item.token] = handler.name
      })
    })
  }

  private validateCommandShape(handler: CommandClass) {
    const fieldOptions: FieldOptionParams[] =
      Reflect.getMetadata(metadata.FIELD_OPTION_IDENTIFIER, handler) || []
    const subOptions: OptionParams[] =
      Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, handler) || []
    const methodHandlers: HandlerParams[] =
      Reflect.getMetadata(metadata.METHOD_HANDLER_IDENTIFIER, handler) || []

    if (!methodHandlers.length) {
      throw createSystemError(
        F_SYSTEM.MISSING_HANDLER,
        errorTypes.REGISTRATION,
        `Command "${handler.name}" must define at least one @Handler method.`,
        { handler: handler.name },
      )
    }

    let defaultHandler = ''
    const tokens: Record<string, string> = {}
    const registerToken = (token: string | undefined, owner: string, type: errorTokenTypes) => {
      if (!token) return
      if (tokens[token]) {
        throw createSystemError(
          F_SYSTEM.DUPLICATE_HANDLER,
          errorTypes.REGISTRATION,
          `Duplicate option token "${token}" found in "${handler.name}".`,
          {
            handler: handler.name,
            owner,
            scope: errorScopes.COMMAND,
            token,
            type,
          },
        )
      }

      tokens[token] = owner
    }

    fieldOptions.forEach(data => {
      this.validateOptionType(data, handler.name)
      registerToken(`--${data.name}`, data.propertyKey, errorTokenTypes.OPTION_NAME)
      registerToken(
        data.alias ? `-${data.alias}` : undefined,
        data.propertyKey,
        errorTokenTypes.OPTION_ALIAS,
      )
    })

    subOptions.forEach(data => {
      this.validateOptionType(data, handler.name)
      registerToken(`--${data.name}`, `SubOptions.${data.name}`, errorTokenTypes.OPTION_NAME)
      registerToken(
        data.alias ? `-${data.alias}` : undefined,
        `SubOptions.${data.name}`,
        errorTokenTypes.OPTION_ALIAS,
      )
    })

    methodHandlers.forEach(data => {
      if (data.flag && data.path) {
        throw createSystemError(
          F_SYSTEM.INVALID_PARAM_VALUE,
          errorTypes.REGISTRATION,
          `Handler "${data.methodName}" in "${handler.name}" cannot define both flag and path.`,
          { handler: handler.name, method: data.methodName },
        )
      }

      if (!data.flag) {
        if (data.path && data.path.length) {
          registerToken(
            data.path.join(' '),
            data.methodName,
            errorTokenTypes.COMMAND_NAME,
          )
          return
        }

        if (defaultHandler) {
          throw createSystemError(
            F_SYSTEM.DUPLICATE_HANDLER,
            errorTypes.REGISTRATION,
            `Command "${handler.name}" must define only one default @Handler method.`,
            { handler: handler.name, methods: [defaultHandler, data.methodName] },
          )
        }

        defaultHandler = data.methodName
        return
      }

      registerToken(`--${data.flag}`, data.methodName, errorTokenTypes.OPTION_NAME)
      registerToken(
        data.alias ? `-${data.alias}` : undefined,
        data.methodName,
        errorTokenTypes.OPTION_ALIAS,
      )
    })
  }

  private validateOptionType(data: OptionParams, handlerName: string) {
    if (data.type !== Array) return

    throw createSystemError(
      F_SYSTEM.UNSUPPORTED_ARRAY_TYPE,
      errorTypes.REGISTRATION,
      `Option "${data.name}" in "${handlerName}" uses Array. Please use [String] instead.`,
      { option: data.name, handler: handlerName },
    )
  }
}
