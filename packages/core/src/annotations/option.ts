import 'reflect-metadata'
import { OptionParams } from '../interfaces'
import * as validator from '../utils/validator'
import { handlers, metadata } from '../utils/metadata'

export const Option = (optionParams: OptionParams) => target => {
  const nextParams = Object.assign({}, { type: Boolean }, optionParams)
  validator.requireKey(nextParams.name, 'name')
  Reflect.defineMetadata(metadata.OPTION_IDENTIFIER, nextParams, target)
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.OPTION, target)
  return target
}
