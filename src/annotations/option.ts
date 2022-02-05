import 'reflect-metadata'
import { OptionParams } from '../interfaces'
import * as validator from '../utils/validator'
import { handlers, metadata } from '../constants/metadata'

export const Option = (optionParams: OptionParams) => target => {
  if (!optionParams.type) {
    optionParams.type = Boolean
  }
  validator.requireKey(optionParams.name, 'name')
  Reflect.defineMetadata(metadata.OPTION_IDENTIFIER, optionParams || {}, target)
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.OPTION, target)
  return target
}
