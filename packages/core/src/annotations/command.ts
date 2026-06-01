import 'reflect-metadata'
import * as validator from '../utils/validator'
import { CommandParams } from '../interfaces'
import { handlers, metadata } from '../utils/metadata'

const commandFactory = (commandParams: CommandParams) => (target: Function) => {
  validator.commandName(commandParams.name, 'name')
  validator.commandAlias(commandParams.alias, 'alias')

  Reflect.defineMetadata(metadata.COMMAND_IDENTIFIER, Object.assign({}, commandParams), target)
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.COMMAND, target)
  return target
}

export const Command = (commandParams: CommandParams) => commandFactory(commandParams)
