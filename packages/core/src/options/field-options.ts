import 'reflect-metadata'
import type {
  FieldOptionDecoratorParams,
  FieldOptionKind,
  FieldOptionParams,
  OptionType,
  ValueDecoratorParams,
} from '../interfaces'
import { F_SYSTEM, createSystemError, errorTypes } from '../errors'
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
    const name = Object.prototype.hasOwnProperty.call(params, 'name')
      ? (params.name ?? '')
      : key
    validator.optionName(name, 'name')
    validator.optionAlias(params.alias, 'alias')
    const type = resolveType(kind, params, target, key)
    const requiredKeys = (Reflect.getMetadata(
      metadata.REQUIRED_FIELD_IDENTIFIER,
      target.constructor,
    ) ?? []) as string[]
    const constraints = (Reflect.getMetadata(
      metadata.FIELD_CONSTRAINT_IDENTIFIER,
      target.constructor,
    ) ?? {}) as Partial<Record<string, Partial<FieldOptionParams>>>
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
      constraints[key] ?? {},
    )
    const options = (Reflect.getMetadata(
      metadata.FIELD_OPTION_IDENTIFIER,
      target.constructor,
    ) ?? []) as FieldOptionParams[]
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
  const designType = Reflect.getMetadata(
    metadata.DESIGN_TYPE,
    target,
    propertyKey,
  ) as OptionType | undefined
  if (designType === String || designType === Number || designType === Boolean)
    return designType

  throw createSystemError(
    F_SYSTEM.CANNOT_INFER_VALUE_TYPE,
    errorTypes.DEFINITION,
    `Cannot infer value type for "${propertyKey}". Please pass type explicitly.`,
    {
      className: target.constructor.name,
      property: propertyKey,
      reason: 'cannot-infer-value-type',
    },
  )
}

const throwInvalidFieldTarget = (propertyKey: string | symbol): never => {
  throw createSystemError(
    F_SYSTEM.INVALID_FIELD_DECORATOR_TARGET,
    errorTypes.DEFINITION,
    `Field option "${String(propertyKey)}" must decorate an instance property.`,
    { property: String(propertyKey) },
  )
}

export const Flag = (params: FieldOptionDecoratorParams = {}): PropertyDecorator =>
  fieldOptionFactory('flag', params)

export const Value = (params: ValueDecoratorParams = {}): PropertyDecorator =>
  fieldOptionFactory('value', params)

export const ArrayValue = (
  params: FieldOptionDecoratorParams = {},
): PropertyDecorator => fieldOptionFactory('array', params)
