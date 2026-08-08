import type arg from 'arg'
import type {
  CommandClass,
  FieldOptionParams,
  HandlerParams,
  OptionParams,
  RegisterCommandParams,
} from '../interfaces'
import { metadata } from './metadata'

export type OptionKeyValue = arg.Spec

export const commandsToDatas = (
  commands: CommandClass[] = [],
): RegisterCommandParams[] => {
  return commands.map(fn => {
    const command = Reflect.getMetadata(
      metadata.COMMAND_IDENTIFIER,
      fn,
    ) as RegisterCommandParams
    const fieldOptions = (Reflect.getMetadata(
      metadata.FIELD_OPTION_IDENTIFIER,
      fn,
    ) ?? []) as FieldOptionParams[]
    const methodHandlers = (Reflect.getMetadata(
      metadata.METHOD_HANDLER_IDENTIFIER,
      fn,
    ) ?? []) as HandlerParams[]
    const subOptions = (Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, fn) ??
      []) as OptionParams[]

    return Object.assign({}, command, {
      fieldOptions: fieldOptions.map(item => Object.assign({}, item)),
      handlers: methodHandlers.map(item => Object.assign({}, item)),
      subOptions: subOptions.map(item => Object.assign({}, item)),
    })
  })
}

export const optionsToKeyValue = (params: OptionParams[] = []): OptionKeyValue => {
  if (!params.length) return {}
  return params.reduce((pre, current) => {
    const name = `--${current.name}`
    const alias = current.alias ? { [`-${current.alias}`]: name } : {}
    return Object.assign(
      {},
      pre,
      {
        [name]: current.type,
      },
      alias,
    )
  }, {})
}

export const removeHyphen = (key: string): string => {
  return key.replace(/^[-]+/, '')
}
