import 'reflect-metadata/lite'
import { SYSTEM } from '@func/contracts/core-errors'
import type { OptionCommandDecoratorParams, OptionCommandParams } from './types'
import { normalizeDeprecation } from '../deprecation'
import { InternalException } from '../shared/errors'
import * as validator from '../definition-validation'
import { metadata as diMetadata } from '../di/metadata'
import { updateFieldMetadata } from './field-metadata'
import { metadata } from './metadata'

export const Option = (): ClassDecorator => target => {
  Reflect.defineMetadata(diMetadata.INJECTABLE_IDENTIFIER, true, target)
  Reflect.defineMetadata(metadata.OPTION_IDENTIFIER, true, target)
}

export const OptionCommand = (
  params: OptionCommandDecoratorParams,
): ClassDecorator => {
  validator.optionName(params.name, 'name')
  const aliases = validator.optionAliases(params.alias, params.aliases)
  const deprecated = normalizeDeprecation(params.deprecated)
  const metadataParams: OptionCommandParams = {
    aliases,
    ...(deprecated ? { deprecated } : {}),
    ...(params.description ? { description: params.description } : {}),
    ...(params.overrideAll ? { overrideAll: true } : {}),
    name: params.name,
    type: Boolean,
  }

  return target => {
    Reflect.defineMetadata(diMetadata.INJECTABLE_IDENTIFIER, true, target)
    Reflect.defineMetadata(
      metadata.OPTION_COMMAND_IDENTIFIER,
      metadataParams,
      target,
    )
  }
}

export const Override = (): PropertyDecorator => (target, propertyKey) => {
  if (typeof target === 'function' || typeof propertyKey !== 'string') {
    throw new InternalException(SYSTEM.INVALID_OVERRIDE_TARGET, {
      details: { property: String(propertyKey) },
    })
  }

  updateFieldMetadata(target, propertyKey, field => ({
    ...field,
    override: true,
  }))
}
