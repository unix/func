import { Mutation } from './mutation'
import { Factory } from '../utils/factory'
import { FuncError } from '../utils/errors'
import { OptionParams } from '../interfaces'
import { errorCodes, errorScopes, errorTokenTypes } from '../constants/errors'
import { metadata, handlers } from '../constants/metadata'

export type ContainerParams = Array<new (...args: any[]) => any>
export interface ContainerData {
  [key: string]: ContainerParams
}

export class Container {
  datas: ContainerData = {}
  mutation: Mutation
  private invalidHandlers: ContainerParams = []

  constructor(private params: ContainerParams) {
    this.mutation = new Mutation()
    this.init()
    this.insert()
  }

  private init() {
    this.params.forEach(handler => {
      const type = Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, handler)
      if (!type) {
        this.invalidHandlers = this.invalidHandlers.concat([handler])
        return
      }

      this.datas[type] = (this.datas[type] || []).concat([handler])
    })
  }

  private insert() {
    try {
      this.validate()
      this.mutation.devour({
        commands: this.datas[handlers.COMMAND] || [],
        options: this.datas[handlers.OPTION] || [],
        missing: this.datas[handlers.MISSING] || [],
        majors: this.datas[handlers.MAJOR] || [],
      })
    } catch (error) {
      this.dispatchError(error)
    }
  }

  private validate() {
    if (this.invalidHandlers.length) {
      const names = this.invalidHandlers.map(handler => handler.name || '<anonymous>')
      throw new FuncError(
        errorCodes.UNKNOWN_HANDLER,
        `All handlers passed to Container must use a func decorator: ${names.join(', ')}.`,
        { handlers: names },
      )
    }

    this.validateDuplicateTokens(
      this.datas[handlers.COMMAND] || [],
      metadata.COMMAND_IDENTIFIER,
      data => [
        { token: data.name, type: errorTokenTypes.COMMAND_NAME },
        { token: data.alias, type: errorTokenTypes.COMMAND_ALIAS },
      ],
      errorScopes.COMMAND,
    )

    this.validateDuplicateTokens(
      this.datas[handlers.OPTION] || [],
      metadata.OPTION_IDENTIFIER,
      data => [
        { token: `--${data.name}`, type: errorTokenTypes.OPTION_NAME },
        {
          token: data.alias ? `-${data.alias}` : undefined,
          type: errorTokenTypes.OPTION_ALIAS,
        },
      ],
      errorScopes.OPTION,
    )

    const optionHandlers = this.datas[handlers.OPTION] || []
    optionHandlers.forEach(handler => {
      const data: OptionParams = Reflect.getMetadata(metadata.OPTION_IDENTIFIER, handler)
      this.validateOptionType(data, handler.name)
    })

    const commandHandlers = this.datas[handlers.COMMAND] || []
    commandHandlers.forEach(handler => {
      const subOptions: OptionParams[] =
        Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, handler) || []
      subOptions.forEach(data => this.validateOptionType(data, handler.name))
    })
  }

  private validateDuplicateTokens(
    handlers: ContainerParams,
    ident: metadata,
    getTokens: (data: any) => Array<{ token?: string; type: errorTokenTypes }>,
    scope: errorScopes,
  ) {
    const tokens = {}

    handlers.forEach(handler => {
      const data = Reflect.getMetadata(ident, handler)
      getTokens(data).forEach(item => {
        if (!item.token) return
        if (tokens[item.token]) {
          throw new FuncError(
            errorCodes.DUPLICATE_HANDLER,
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

  private validateOptionType(data: OptionParams, handlerName: string) {
    if (data.type !== Array) return

    throw new FuncError(
      errorCodes.UNSUPPORTED_ARRAY_TYPE,
      `Option "${data.name}" in "${handlerName}" uses Array. Please use [String] instead.`,
      { option: data.name, handler: handlerName },
    )
  }

  private dispatchError(error: Error) {
    const errors = this.datas[handlers.ERROR] || []
    if (!errors.length) {
      throw error
    }

    const factory = new Factory({
      nativeOption: {},
      args: { _: [] },
      commands: this.datas[handlers.COMMAND] || [],
      options: this.datas[handlers.OPTION] || [],
    })

    errors.forEach(errorHandler => {
      const params = factory.getServiceParams(errorHandler, undefined, error)
      new errorHandler(...params)
    })
  }
}
