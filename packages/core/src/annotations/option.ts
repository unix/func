import 'reflect-metadata'
import { OptionParams } from '../interfaces'
import * as validator from '../utils/validator'
import { handlers, metadata } from '../utils/metadata'

export const Option = (optionParams: OptionParams): ClassDecorator => target => {
  const nextParams = Object.assign({}, { type: Boolean }, optionParams)
  validator.optionName(nextParams.name, 'name')
  validator.optionAlias(nextParams.alias, 'alias')
  Reflect.defineMetadata(metadata.OPTION_IDENTIFIER, nextParams, target)
  Reflect.defineMetadata(metadata.HANDLER_IDENTIFIER, handlers.OPTION, target)
}
