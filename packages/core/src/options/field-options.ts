import 'reflect-metadata/lite'
import { SYSTEM } from '@func/contracts/core-errors'
import type {
  ArrayNumberDecoratorInput,
  ArrayStringDecoratorInput,
  FieldOptionKind,
  FieldOptionParams,
  FlagDecoratorInput,
  ValueDecorator,
  ValueDecoratorInput,
  ValueOptionType,
  ValueTransform,
} from './types'
import { InternalException } from '../shared/errors'
import * as validator from '../definition-validation'
import { metadata } from './metadata'
import { updateFieldMetadata } from './field-metadata'

interface FieldOptionBaseParams {
  aliases: readonly string[]
  name: string
  propertyKey: string
  description?: string
}

interface FieldOptionCreation {
  arrayType?: ValueOptionType
  negatable: boolean
  transformed: boolean
}

type FieldOptionDecoratorInput =
  | ArrayNumberDecoratorInput
  | ArrayStringDecoratorInput
  | FlagDecoratorInput
  | ValueDecoratorInput

const fieldOptionFactory =
  (
    kind: FieldOptionKind,
    input: FieldOptionDecoratorInput,
    arrayType?: ValueOptionType,
    transform?: ValueTransform,
  ): PropertyDecorator =>
  (target, propertyKey) => {
    const params = typeof input === 'string' ? { name: input } : input
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
    const nextOption = createFieldOption(kind, base, target, {
      ...(arrayType ? { arrayType } : {}),
      negatable,
      transformed: Boolean(transform),
    })
    updateFieldMetadata(target, key, field => ({
      ...field,
      options: field.options.concat([
        {
          option: nextOption,
          ...(transform ? { transform } : {}),
        },
      ]),
    }))
  }

const createFieldOption = (
  kind: FieldOptionKind,
  params: FieldOptionBaseParams,
  target: Object,
  creation: FieldOptionCreation,
): FieldOptionParams => {
  const { arrayType, negatable, transformed } = creation
  if (kind === 'flag') {
    return {
      ...params,
      ...(negatable ? { negatable: true } : {}),
      kind,
      type: Boolean,
    }
  }
  if (kind === 'array') {
    const type = arrayType ?? throwMissingArrayType(params.propertyKey)

    return {
      ...params,
      kind,
      type: [resolveArrayValueType(type, target, params.propertyKey)],
    }
  }

  return {
    ...params,
    kind,
    type: transformed ? String : resolveValueType(target, params.propertyKey),
  }
}

const resolveArrayValueType = (
  type: ValueOptionType,
  target: Object,
  propertyKey: string,
): ValueOptionType => {
  const designType: unknown = Reflect.getMetadata(
    metadata.DESIGN_TYPE,
    target,
    propertyKey,
  )
  if (designType === Array) return type
  if (designType !== undefined && designType !== Object)
    return throwInvalidArrayFieldType(designType, type, target, propertyKey)

  return throwCannotInferValueType(target, propertyKey, arrayTypeName(type))
}

const resolveValueType = (target: Object, propertyKey: string): ValueOptionType => {
  const designType: unknown = Reflect.getMetadata(
    metadata.DESIGN_TYPE,
    target,
    propertyKey,
  )
  if (isValueOptionType(designType)) return designType
  if (designType === Boolean || designType === Array) {
    throwInvalidValueType(designType, target, propertyKey)
  }

  return throwCannotInferValueType(target, propertyKey, 'string or number')
}

const throwCannotInferValueType = (
  target: Object,
  propertyKey: string,
  expectedType: string,
): never => {
  throw new InternalException(SYSTEM.CANNOT_INFER_VALUE_TYPE, {
    details: {
      className: target.constructor.name,
      expectedType,
      property: propertyKey,
      reason: 'cannot-infer-value-type',
    },
  })
}

const isValueOptionType = (value: unknown): value is ValueOptionType =>
  value === String || value === Number

const throwInvalidValueType = (
  value: unknown,
  target: Object,
  propertyKey: string,
): never => {
  const type = optionTypeName(value)
  throw new InternalException(SYSTEM.INVALID_OPTION_TYPE, {
    details: {
      className: target.constructor.name,
      property: propertyKey,
      type,
    },
  })
}

const throwInvalidArrayFieldType = (
  value: unknown,
  type: ValueOptionType,
  target: Object,
  propertyKey: string,
): never => {
  const expectedType = arrayTypeName(type)
  const designType = optionTypeName(value)
  throw new InternalException(SYSTEM.INVALID_OPTION_TYPE, {
    details: {
      className: target.constructor.name,
      expectedType,
      property: propertyKey,
      type: designType,
    },
  })
}

const throwMissingArrayType = (propertyKey: string): never => {
  throw new InternalException(SYSTEM.INTERNAL_INVARIANT, {
    details: { property: propertyKey },
  })
}

const arrayTypeName = (type: ValueOptionType): string =>
  type === String ? 'string[]' : 'number[]'

const optionTypeName = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(optionTypeName).join(', ')}]`
  if (typeof value === 'function') return value.name || '(anonymous function)'
  return String(value)
}

const throwInvalidFieldTarget = (propertyKey: string | symbol): never => {
  throw new InternalException(SYSTEM.INVALID_FIELD_DECORATOR_TARGET, {
    details: { kind: 'option', property: String(propertyKey) },
  })
}

export const Flag = (input: FlagDecoratorInput = {}): PropertyDecorator =>
  fieldOptionFactory('flag', input)

export const Value = (input: ValueDecoratorInput = {}): PropertyDecorator =>
  fieldOptionFactory('value', input)

export const createValueDecorator =
  <Output>(transform: ValueTransform<Output>): ValueDecorator =>
  (input: ValueDecoratorInput = {}) =>
    fieldOptionFactory('value', input, undefined, transform)

export const ArrayString = (
  input: ArrayStringDecoratorInput = {},
): PropertyDecorator => fieldOptionFactory('array', input, String)

export const ArrayNumber = (
  input: ArrayNumberDecoratorInput = {},
): PropertyDecorator => fieldOptionFactory('array', input, Number)
