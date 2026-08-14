import 'reflect-metadata/lite'
import { SYSTEM } from '@func/shared/core-errors'
import type {
  ArrayValueDecoratorParams,
  FieldOptionDecoratorParams,
  FieldOptionKind,
  FieldOptionParams,
  FlagDecoratorParams,
  ValueOptionType,
  ValueDecoratorParams,
} from '../interfaces'
import { InternalException } from '../shared/errors'
import * as validator from '../utils/validator'
import { metadata } from '../utils/metadata'
import { updateFieldMetadata } from './field-metadata'

interface FieldOptionBaseParams {
  aliases: readonly string[]
  name: string
  propertyKey: string
  description?: string
}

const fieldOptionFactory =
  (
    kind: FieldOptionKind,
    params:
      | ArrayValueDecoratorParams
      | ValueDecoratorParams
      | FlagDecoratorParams
      | FieldOptionDecoratorParams = {},
  ): PropertyDecorator =>
  (target, propertyKey) => {
    if (typeof target === 'function') throwInvalidFieldTarget(propertyKey)
    const key =
      typeof propertyKey === 'string'
        ? propertyKey
        : throwInvalidFieldTarget(propertyKey)
    const name = Object.prototype.hasOwnProperty.call(params, 'name')
      ? (params.name ?? '')
      : key
    validator.optionName(name, 'name')
    const aliases = validator.optionAliases(params.alias, params.aliases)
    const explicitType: unknown = 'type' in params ? params.type : undefined
    const base: FieldOptionBaseParams = {
      aliases,
      name,
      propertyKey: key,
      ...(params.description !== undefined
        ? { description: params.description }
        : {}),
    }
    const negatable =
      kind === 'flag' && 'negatable' in params && params.negatable === true
    const nextOption = createFieldOption(kind, base, explicitType, negatable, target)
    updateFieldMetadata(target, key, field => ({
      ...field,
      options: field.options.concat([nextOption]),
    }))
  }

const createFieldOption = (
  kind: FieldOptionKind,
  params: FieldOptionBaseParams,
  explicitType: unknown,
  negatable: boolean,
  target: Object,
): FieldOptionParams => {
  if (kind === 'flag') {
    return {
      ...params,
      ...(negatable ? { negatable: true } : {}),
      kind,
      type: Boolean,
    }
  }
  if (kind === 'array') {
    return {
      ...params,
      kind,
      type: [resolveArrayValueType(explicitType, target, params.propertyKey)],
    }
  }

  return {
    ...params,
    kind,
    type: resolveValueType(explicitType, target, params.propertyKey),
  }
}

const resolveArrayValueType = (
  explicitType: unknown,
  target: Object,
  propertyKey: string,
): ValueOptionType => {
  if (explicitType === undefined) return String
  if (isValueOptionType(explicitType)) return explicitType
  return throwInvalidValueType(explicitType, target, propertyKey, 'ArrayValue')
}

const resolveValueType = (
  explicitType: unknown,
  target: Object,
  propertyKey: string,
): ValueOptionType => {
  if (explicitType !== undefined) {
    if (isValueOptionType(explicitType)) return explicitType
    throwInvalidValueType(explicitType, target, propertyKey, 'Value')
  }

  const designType: unknown = Reflect.getMetadata(
    metadata.DESIGN_TYPE,
    target,
    propertyKey,
  )
  if (isValueOptionType(designType)) return designType
  if (designType === Boolean || designType === Array) {
    throwInvalidValueType(designType, target, propertyKey, 'Value')
  }

  throw new InternalException(SYSTEM.CANNOT_INFER_VALUE_TYPE, {
    details: {
      className: target.constructor.name,
      property: propertyKey,
      reason: 'cannot-infer-value-type',
    },
    message: `Cannot infer value type for "${propertyKey}". Please pass type explicitly.`,
  })
}

const isValueOptionType = (value: unknown): value is ValueOptionType =>
  value === String || value === Number

const throwInvalidValueType = (
  value: unknown,
  target: Object,
  propertyKey: string,
  decorator: 'ArrayValue' | 'Value',
): never => {
  const type = optionTypeName(value)
  const hint =
    value === Boolean
      ? ' Use @Flag for boolean options.'
      : decorator === 'Value' && (value === Array || Array.isArray(value))
        ? ' Use @ArrayValue for repeated options.'
        : ''
  throw new InternalException(SYSTEM.INVALID_OPTION_TYPE, {
    details: {
      className: target.constructor.name,
      property: propertyKey,
      type,
    },
    message: `@${decorator} type "${type}" is unsupported. Use String or Number.${hint}`,
  })
}

const optionTypeName = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(optionTypeName).join(', ')}]`
  if (typeof value === 'function') return value.name || '(anonymous function)'
  return String(value)
}

const throwInvalidFieldTarget = (propertyKey: string | symbol): never => {
  throw new InternalException(SYSTEM.INVALID_FIELD_DECORATOR_TARGET, {
    details: { property: String(propertyKey) },
    message: `Field option "${String(propertyKey)}" must decorate an instance property.`,
  })
}

export const Flag = (params: FlagDecoratorParams = {}): PropertyDecorator =>
  fieldOptionFactory('flag', params)

export const Value = (params: ValueDecoratorParams = {}): PropertyDecorator =>
  fieldOptionFactory('value', params)

export const ArrayValue = (
  params: ArrayValueDecoratorParams = {},
): PropertyDecorator => fieldOptionFactory('array', params)
