import 'reflect-metadata/lite'
import * as validator from '../utils/validator'
import type {
  CommandDecoratorInput,
  CommandDecoratorParams,
  CommandParams,
  CommandPath,
} from '../interfaces'
import { normalizeDeprecation } from '../deprecation'
import { handlers, metadata } from '../utils/metadata'

interface CommandDecorator {
  (input: CommandDecoratorInput): ClassDecorator
}

export const Command: CommandDecorator = input => target => {
  const command = normalizeCommand(input)
  Reflect.defineMetadata(metadata.COMMAND_IDENTIFIER, command, target)
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.COMMAND, target)
}

const normalizeCommand = (input: CommandDecoratorInput): CommandParams => {
  const params = isCommandParams(input) ? input : { path: input }
  const path = normalizeCommandPath(params.path)
  const aliases = validator.commandAliases(params.alias, params.aliases)
  const deprecated = normalizeDeprecation(params.deprecated)

  return {
    aliases,
    ...(deprecated ? { deprecated } : {}),
    ...(params.description ? { description: params.description } : {}),
    path,
  }
}

const isCommandParams = (
  input: CommandDecoratorInput,
): input is CommandDecoratorParams =>
  typeof input === 'object' && !Array.isArray(input)

const normalizeCommandPath = (input: CommandPath): string[] => {
  const path: string[] = typeof input === 'string' ? [input] : [...input]
  if (!path.length) validator.commandName('', 'path')
  path.forEach(segment => validator.commandName(segment, 'path'))
  return path
}
