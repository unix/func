import 'reflect-metadata'
import {
  FieldOptionParams,
  UserOptionEnumValue,
  ValueValidator,
} from '../interfaces'
import {
  F_SYSTEM,
  createSystemError,
  errorTypes,
} from '../errors'
import { metadata } from '../utils/metadata'
import * as validator from '../utils/validator'

interface FieldConstraintParams {
  enum?: UserOptionEnumValue[]
  dependsOn?: string[]
  exclusive?: string[]
}

const throwInvalidFieldTarget = (propertyKey: string | symbol): never => {
  throw createSystemError(
    F_SYSTEM.INVALID_PARAM_TYPE,
    errorTypes.DEFINITION,
    `Field validator "${String(propertyKey)}" must decorate an instance property.`,
    { property: String(propertyKey) },
  )
}

export const Required =
  (): PropertyDecorator =>
  (target, propertyKey) => {
    if (typeof target === 'function' || typeof propertyKey !== 'string') {
      throwInvalidFieldTarget(propertyKey)
    }

    const key = propertyKey as string
    const requiredKeys: string[] =
      Reflect.getMetadata(metadata.REQUIRED_FIELD_IDENTIFIER, target.constructor) || []
    Reflect.defineMetadata(
      metadata.REQUIRED_FIELD_IDENTIFIER,
      requiredKeys.includes(key) ? requiredKeys : requiredKeys.concat([key]),
      target.constructor,
    )

    const options = Reflect.getMetadata(metadata.FIELD_OPTION_IDENTIFIER, target.constructor) || []
    Reflect.defineMetadata(
      metadata.FIELD_OPTION_IDENTIFIER,
      options.map((item: FieldOptionParams) => {
        if (item.propertyKey !== key) return item

        return Object.assign({}, item, { required: true })
      }),
      target.constructor,
    )
  }

export const Enum =
  (values: UserOptionEnumValue[]): PropertyDecorator =>
  (target, propertyKey) => {
    validator.mustBeArray(values, 'enum')
    defineFieldConstraint(target, propertyKey, { enum: values })
  }

export const DependsOn =
  (options: string[]): PropertyDecorator =>
  (target, propertyKey) => {
    validator.mustBeArray(options, 'dependsOn')
    options.forEach(item => validator.optionName(item, 'dependsOn'))
    defineFieldConstraint(target, propertyKey, { dependsOn: options })
  }

export const Exclusive =
  (options: string[]): PropertyDecorator =>
  (target, propertyKey) => {
    validator.mustBeArray(options, 'exclusive')
    options.forEach(item => validator.optionName(item, 'exclusive'))
    defineFieldConstraint(target, propertyKey, { exclusive: options })
  }

export const ValueValidate =
  (fn: ValueValidator): PropertyDecorator =>
  (target, propertyKey) => {
    if (typeof target === 'function' || typeof propertyKey !== 'string') {
      throwInvalidFieldTarget(propertyKey)
    }

    const key = propertyKey as string
    const validators = Reflect.getMetadata(metadata.VALUE_VALIDATOR_IDENTIFIER, target.constructor) || {}
    Reflect.defineMetadata(
      metadata.VALUE_VALIDATOR_IDENTIFIER,
      Object.assign({}, validators, {
        [key]: (validators[key] || []).concat([fn]),
      }),
      target.constructor,
    )
  }

const defineFieldConstraint = (
  target: Object,
  propertyKey: string | symbol,
  params: FieldConstraintParams,
) => {
  if (typeof target === 'function' || typeof propertyKey !== 'string') {
    throwInvalidFieldTarget(propertyKey)
  }

  const key = propertyKey as string
  const constraints: Record<string, FieldConstraintParams> =
    Reflect.getMetadata(metadata.FIELD_CONSTRAINT_IDENTIFIER, target.constructor) || {}
  const nextParams = Object.assign({}, constraints[key] || {}, params)
  Reflect.defineMetadata(
    metadata.FIELD_CONSTRAINT_IDENTIFIER,
    Object.assign({}, constraints, { [key]: nextParams }),
    target.constructor,
  )

  const options = Reflect.getMetadata(metadata.FIELD_OPTION_IDENTIFIER, target.constructor) || []
  Reflect.defineMetadata(
    metadata.FIELD_OPTION_IDENTIFIER,
    options.map((item: FieldOptionParams) => {
      if (item.propertyKey !== key) return item

      return Object.assign({}, item, nextParams)
    }),
    target.constructor,
  )
}
