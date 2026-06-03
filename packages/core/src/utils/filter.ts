import type arg from 'arg'
import {
  CommandClass,
  FieldOptionParams,
  HandlerParams,
  OptionParams,
} from '../interfaces'
import { metadata } from './metadata'

export type OptionKeyValue = arg.Spec

export const commandsToDatas = (commands: CommandClass[] = []) => {
  return commands.map(fn =>
    Object.assign({}, Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, fn), {
      fieldOptions: (Reflect.getMetadata(metadata.FIELD_OPTION_IDENTIFIER, fn) || []).map(
        (item: FieldOptionParams) => Object.assign({}, item),
      ),
      handlers: (Reflect.getMetadata(metadata.METHOD_HANDLER_IDENTIFIER, fn) || []).map(
        (item: HandlerParams) => Object.assign({}, item),
      ),
      subOptions: (Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, fn) || []).map(
        (item: OptionParams) => Object.assign({}, item),
      ),
    }),
  )
}

export const optionsToKeyValue = (params: OptionParams[] = []): OptionKeyValue => {
  if (!params || !params.length) return {}
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
