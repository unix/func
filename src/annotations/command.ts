import 'reflect-metadata'
import * as validator from '../utils/validator'
import { CommandParams } from '../interfaces'
import { handlers, metadata } from '../constants/metadata'

const commandFactory = (commandOptions: CommandParams) => target => {
  validator.requireKey(commandOptions.name, 'name')
  
  Reflect.defineMetadata(metadata.COMMAND_IDENTIFIER, commandOptions || {}, target)
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.COMMAND, target)
  return target
}

export const Command = (commandOptions: CommandParams) => commandFactory(commandOptions)

