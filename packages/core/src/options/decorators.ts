import 'reflect-metadata/lite'
import { SYSTEM } from '@func/shared/core-errors'
import type {
  OptionCommandDecoratorParams,
  OptionCommandParams,
} from '../interfaces'
import { normalizeDeprecation } from '../deprecation'
import { InternalException } from '../shared/errors'
import * as validator from '../utils/validator'
import { metadata } from '../utils/metadata'
import { updateFieldMetadata } from './field-metadata'

export const Option = (): ClassDecorator => target => {
  Reflect.defineMetadata(metadata.INJECTABLE_IDENTIFIER, true, target)
  Reflect.defineMetadata(metadata.OPTION_IDENTIFIER, true, target)
}

export const OptionCommand = (
  params: OptionCommandDecoratorParams,
): ClassDecorator => {
  validator.optionName(params.name, 'name')
  const aliases = validator.optionAliases(params.alias, params.aliases)
  const deprecated = normalizeDeprecation(params.deprecated)
  const metadataParams: OptionCommandParams = Object.freeze({
    aliases,
    ...(deprecated ? { deprecated } : {}),
    ...(params.description ? { description: params.description } : {}),
    ...(params.overrideAll ? { overrideAll: true } : {}),
    name: params.name,
    type: Boolean,
  })

  return target => {
    Reflect.defineMetadata(metadata.INJECTABLE_IDENTIFIER, true, target)
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
      message: '@Override must decorate an instance option field.',
    })
  }

  updateFieldMetadata(target, propertyKey, field => ({
    ...field,
    override: true,
  }))
}
