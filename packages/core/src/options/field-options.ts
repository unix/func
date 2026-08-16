import 'reflect-metadata/lite'
import { SYSTEM } from '@func/contracts/core-errors'
import type {
  ArrayNumberDecoratorInput,
  ArrayStringDecoratorInput,
  FieldOptionKind,
  FieldOptionParams,
  FlagDecoratorInput,
  ValueDecoratorInput,
  ValueOptionType,
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
    const nextOption = createFieldOption(kind, base, negatable, target, arrayType)
    updateFieldMetadata(target, key, field => ({
      ...field,
      options: field.options.concat([nextOption]),
    }))
  }

const createFieldOption = (
  kind: FieldOptionKind,
  params: FieldOptionBaseParams,
  negatable: boolean,
  target: Object,
  arrayType?: ValueOptionType,
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
    type: resolveValueType(target, params.propertyKey),
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
    message: `Cannot infer value type for "${propertyKey}". Declare the property as ${expectedType} and ensure emitDecoratorMetadata is enabled.`,
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
  const hint =
    value === Boolean
      ? ' Use @Flag() for boolean options.'
      : value === Array
        ? ' Use @ArrayString() or @ArrayNumber() for repeated options.'
        : ''
  throw new InternalException(SYSTEM.INVALID_OPTION_TYPE, {
    details: {
      className: target.constructor.name,
      property: propertyKey,
      type,
    },
    message: `@Value type "${type}" is unsupported. Declare the property as string or number.${hint}`,
  })
}

const throwInvalidArrayFieldType = (
  value: unknown,
  type: ValueOptionType,
  target: Object,
  propertyKey: string,
): never => {
  const decorator = type === String ? 'ArrayString' : 'ArrayNumber'
  const expectedType = arrayTypeName(type)
  const designType = optionTypeName(value)
  throw new InternalException(SYSTEM.INVALID_OPTION_TYPE, {
    details: {
      className: target.constructor.name,
      expectedType,
      property: propertyKey,
      type: designType,
    },
    message: `@${decorator} requires an array property, but "${propertyKey}" has runtime type "${designType}". Declare the property as ${expectedType}.`,
  })
}

const throwMissingArrayType = (propertyKey: string): never => {
  throw new TypeError(`Missing array type for "${propertyKey}".`)
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
    details: { property: String(propertyKey) },
    message: `Field option "${String(propertyKey)}" must decorate an instance property.`,
  })
}

export const Flag = (input: FlagDecoratorInput = {}): PropertyDecorator =>
  fieldOptionFactory('flag', input)

export const Value = (input: ValueDecoratorInput = {}): PropertyDecorator =>
  fieldOptionFactory('value', input)

export const ArrayString = (
  input: ArrayStringDecoratorInput = {},
): PropertyDecorator => fieldOptionFactory('array', input, String)

export const ArrayNumber = (
  input: ArrayNumberDecoratorInput = {},
): PropertyDecorator => fieldOptionFactory('array', input, Number)
