import 'reflect-metadata'
import * as validator from '../utils/validator'
import { OptionParams } from '../interfaces'
import { metadata } from '../utils/metadata'

export const SubOptions =
  (commandOptions: OptionParams[] = []): ClassDecorator =>
  target => {
    validator.mustBeArray(commandOptions, 'SubOptions Params')

    const nextOptions = commandOptions.map(item => {
      validator.optionName(item.name, 'SubOptions name')
      validator.optionAlias(item.alias, 'SubOptions alias')
      return Object.assign({}, { type: Boolean }, item)
    })
    Reflect.defineMetadata(metadata.SUB_OPTION_IDENTIFIER, nextOptions, target)
  }
