import 'reflect-metadata'
import * as validator from '../utils/validator'
import { CommandParams } from '../interfaces'
import { handlers, metadata } from '../constants/metadata'

const commandFactory = (commandParams: CommandParams) => target => {
  validator.requireKey(commandParams.name, 'name')

  Reflect.defineMetadata(metadata.COMMAND_IDENTIFIER, commandParams || {}, target)
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.COMMAND, target)
  return target
}

export const Command = (commandParams: CommandParams) => commandFactory(commandParams)
