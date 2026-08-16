import { SYSTEM } from '@func/contracts/core-errors'
import type { UserOptionEnumValue, ValueValidator } from './types'
import { InternalException } from '../shared/errors'
import * as validator from '../definition-validation'
import type { FieldConstraints } from './field-metadata'
import { updateFieldMetadata } from './field-metadata'

const throwInvalidFieldTarget = (propertyKey: string | symbol): never => {
  throw new InternalException(SYSTEM.INVALID_FIELD_DECORATOR_TARGET, {
    details: { property: String(propertyKey) },
    message: `Field validator "${String(propertyKey)}" must decorate an instance property.`,
  })
}

export const Required = (): PropertyDecorator => (target, propertyKey) => {
  if (typeof target === 'function' || typeof propertyKey !== 'string') {
    throwInvalidFieldTarget(propertyKey)
  }

  updateFieldMetadata(target, propertyKey as string, field => ({
    ...field,
    required: true,
  }))
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

    updateFieldMetadata(target, propertyKey as string, field => ({
      ...field,
      validators: field.validators.concat([fn]),
    }))
  }

const defineFieldConstraint = (
  target: Object,
  propertyKey: string | symbol,
  params: FieldConstraints,
) => {
  if (typeof target === 'function' || typeof propertyKey !== 'string') {
    throwInvalidFieldTarget(propertyKey)
  }

  updateFieldMetadata(target, propertyKey as string, field => ({
    ...field,
    constraints: { ...field.constraints, ...params },
  }))
}
