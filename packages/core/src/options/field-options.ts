import 'reflect-metadata/lite'
import { SYSTEM } from '@func/contracts/core-errors'
import type {
  ArrayNumberDecoratorInput,
  ArrayStringDecoratorInput,
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

type FieldOptionCreation =
  | { kind: 'array'; type: ValueOptionType }
  | { kind: 'flag' }
  | { kind: 'value'; transform?: ValueTransform }

type FieldOptionDecoratorInput =
  | ArrayNumberDecoratorInput
  | ArrayStringDecoratorInput
  | FlagDecoratorInput
  | ValueDecoratorInput

const fieldOptionFactory =
  (
    creation: FieldOptionCreation,
    input: FieldOptionDecoratorInput,
  ): PropertyDecorator =>
  (target, propertyKey) => {
    const { kind } = creation
    const transform = creation.kind === 'value' ? creation.transform : undefined
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
    const nextOption = createFieldOption(creation, base, target, negatable)
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
  creation: FieldOptionCreation,
  params: FieldOptionBaseParams,
  target: Object,
  negatable: boolean,
): FieldOptionParams => {
  if (creation.kind === 'flag') {
    return {
      ...params,
      ...(negatable ? { negatable: true } : {}),
      kind: creation.kind,
      type: Boolean,
    }
  }
  if (creation.kind === 'array') {
    return {
      ...params,
      kind: creation.kind,
      type: [resolveArrayValueType(creation.type, target, params.propertyKey)],
    }
  }

  return {
    ...params,
    kind: creation.kind,
    type: creation.transform ? String : resolveValueType(target, params.propertyKey),
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
  fieldOptionFactory({ kind: 'flag' }, input)

export const Value = (input: ValueDecoratorInput = {}): PropertyDecorator =>
  fieldOptionFactory({ kind: 'value' }, input)

export const createValueDecorator =
  <Output>(transform: ValueTransform<Output>): ValueDecorator =>
  (input: ValueDecoratorInput = {}) =>
    fieldOptionFactory({ kind: 'value', transform }, input)

export const ArrayString = (
  input: ArrayStringDecoratorInput = {},
): PropertyDecorator => fieldOptionFactory({ kind: 'array', type: String }, input)

export const ArrayNumber = (
  input: ArrayNumberDecoratorInput = {},
): PropertyDecorator => fieldOptionFactory({ kind: 'array', type: Number }, input)
