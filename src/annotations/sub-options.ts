import 'reflect-metadata'
import * as validator from '../utils/validator'
import { OptionParams } from '../interfaces'
import { metadata } from '../constants/metadata'

export const SubOptions = (commandOptions: OptionParams[] = []) => target => {
  validator.mustBeArray(commandOptions, 'SubOptions Params')
  
  const nextOptions = commandOptions.map(item => {
    validator.requireKey(item.name, 'SubOptions name')
    return Object.assign({}, { type: Boolean }, item)
  })
  Reflect.defineMetadata(metadata.SUB_OPTION_IDENTIFIER, nextOptions, target)
  return target
}

