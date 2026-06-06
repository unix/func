import 'reflect-metadata'
import {
  FieldOptionDecoratorParams,
  FieldOptionKind,
  FieldOptionParams,
  OptionType,
  ValueDecoratorParams,
} from '../interfaces'
import {
  F_SYSTEM,
  createSystemError,
  errorTypes,
} from '../errors'
import * as validator from '../utils/validator'
import { metadata } from '../utils/metadata'

const fieldOptionFactory =
  (
    kind: FieldOptionKind,
    params: ValueDecoratorParams | FieldOptionDecoratorParams = {},
  ): PropertyDecorator =>
  (target, propertyKey) => {
    if (typeof target === 'function' || typeof propertyKey !== 'string') {
      throwInvalidFieldTarget(propertyKey)
    }

    const key = propertyKey as string
    const name = Object.prototype.hasOwnProperty.call(params, 'name') ? params.name || '' : key
    validator.optionName(name, 'name')
    validator.optionAlias(params.alias, 'alias')

    const type = resolveType(kind, params, target, key)
    const requiredKeys: string[] =
      Reflect.getMetadata(metadata.REQUIRED_FIELD_IDENTIFIER, target.constructor) || []
    const constraints = Reflect.getMetadata(metadata.FIELD_CONSTRAINT_IDENTIFIER, target.constructor) || {}
    const nextOption: FieldOptionParams = Object.assign(
      {},
      {
        kind,
        name,
        propertyKey: key,
        required: requiredKeys.includes(key),
        type,
      },
      params,
      constraints[key] || {},
    )
    const options = Reflect.getMetadata(metadata.FIELD_OPTION_IDENTIFIER, target.constructor) || []
    Reflect.defineMetadata(
      metadata.FIELD_OPTION_IDENTIFIER,
      options.concat([nextOption]),
      target.constructor,
    )
  }

const resolveType = (
  kind: FieldOptionKind,
  params: ValueDecoratorParams | FieldOptionDecoratorParams,
  target: Object,
  propertyKey: string,
): OptionType => {
  if (kind === 'flag') return Boolean
  if (kind === 'array') return [String]

  const explicitType = (params as ValueDecoratorParams).type
  if (explicitType) return explicitType

  const designType = Reflect.getMetadata(metadata.DESIGN_TYPE, target, propertyKey)
  if (designType === String || designType === Number || designType === Boolean) return designType

  throw createSystemError(
    F_SYSTEM.INVALID_PARAM_TYPE,
    errorTypes.DEFINITION,
    `Cannot infer value type for "${propertyKey}". Please pass type explicitly.`,
    {
      property: propertyKey,
      reason: 'cannot-infer-value-type',
    },
  )
}

const throwInvalidFieldTarget = (propertyKey: string | symbol): never => {
  throw createSystemError(
    F_SYSTEM.INVALID_PARAM_TYPE,
    errorTypes.DEFINITION,
    `Field option "${String(propertyKey)}" must decorate an instance property.`,
    { property: String(propertyKey) },
  )
}

export const Flag = (params: FieldOptionDecoratorParams = {}): PropertyDecorator =>
  fieldOptionFactory('flag', params)

export const Value = (params: ValueDecoratorParams = {}): PropertyDecorator =>
  fieldOptionFactory('value', params)

export const ArrayValue = (params: FieldOptionDecoratorParams = {}): PropertyDecorator =>
  fieldOptionFactory('array', params)
