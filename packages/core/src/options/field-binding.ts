import { RUNTIME, SYSTEM } from '@func/contracts/core-errors'
import type { UserOption } from './types'
import { ErrorScope, InternalException, isException } from '../shared/errors'
import { ConstraintValidator } from './constraints'
import type { CompiledFieldOption } from './field-metadata'

interface FieldBindingParams {
  fieldOptions: readonly CompiledFieldOption[]
  instance: unknown
  options: UserOption
  supplied: ReadonlySet<string>
  validate?: boolean
}

export const bindFieldOptions = ({
  fieldOptions,
  instance,
  options,
  supplied,
  validate = true,
}: FieldBindingParams) => {
  bindFieldValues(fieldOptions, instance, options, supplied)
  if (!validate) return
  validateRequiredFields(fieldOptions, options)
  validateFieldValues(fieldOptions, options)
  new ConstraintValidator(fieldOptions, options, supplied).validate()
}

const bindFieldValues = (
  fieldOptions: readonly CompiledFieldOption[],
  instance: unknown,
  options: UserOption,
  supplied: ReadonlySet<string>,
) => {
  const target = fieldTarget(instance)
  fieldOptions.forEach(data => {
    const hasDefault = Object.prototype.hasOwnProperty.call(target, data.propertyKey)
    const value = supplied.has(data.name)
      ? transformFieldValue(data, options[data.name])
      : hasDefault
        ? target[data.propertyKey]
        : undefined
    Object.defineProperty(target, data.propertyKey, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    })
    options[data.name] = value
  })
}

interface FieldTarget {
  [propertyKey: string]: unknown
}

const transformFieldValue = (data: CompiledFieldOption, value: unknown): unknown => {
  if (!data.transform) return value
  if (typeof value !== 'string') {
    throw new InternalException(SYSTEM.INTERNAL_INVARIANT, {
      details: { option: data.name, value },
    })
  }

  try {
    const transformed = data.transform(value)
    if (isPromiseLike(transformed)) {
      throw new TypeError(
        `Value transform for option "--${data.name}" must return synchronously.`,
      )
    }
    return transformed
  } catch (error) {
    return throwFieldValidationError(error, data, value)
  }
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  typeof Reflect.get(value, 'then') === 'function'

const fieldTarget = (value: unknown): FieldTarget => {
  if (isFieldTarget(value)) return value
  throw new InternalException(RUNTIME.HANDLER_ERROR, {
    details: { instance: value },
    message: 'Field options can only be bound to an object instance.',
    scope: ErrorScope.RUNTIME,
  })
}

const isFieldTarget = (value: unknown): value is FieldTarget =>
  typeof value === 'object' && value !== null

const validateRequiredFields = (
  fieldOptions: readonly CompiledFieldOption[],
  options: UserOption,
) => {
  fieldOptions.forEach(data => {
    if (data.required && options[data.name] === undefined) {
      throw new InternalException(RUNTIME.VALIDATION, {
        details: { option: data.name },
        message: `Option "--${data.name}" is required.`,
        scope: ErrorScope.RUNTIME,
      })
    }
  })
}

const validateFieldValues = (
  fieldOptions: readonly CompiledFieldOption[],
  options: UserOption,
) => {
  fieldOptions.forEach(data => {
    data.validators.forEach(fn => {
      try {
        const result = fn(options[data.name], options)
        if (result === false || typeof result === 'string') {
          throw new InternalException(RUNTIME.VALIDATION, {
            details: { option: data.name, value: options[data.name] },
            message:
              typeof result === 'string'
                ? result
                : `Option "--${data.name}" is invalid.`,
            scope: ErrorScope.RUNTIME,
          })
        }
      } catch (error) {
        throwFieldValidationError(error, data, options[data.name])
      }
    })
  })
}

const throwFieldValidationError = (
  error: unknown,
  data: CompiledFieldOption,
  value: unknown,
): never => {
  if (isException(error)) throw error

  throw new InternalException(RUNTIME.VALIDATION, {
    cause: error instanceof Error ? error : undefined,
    details: { option: data.name, value },
    message: error instanceof Error ? error.message : String(error),
    scope: ErrorScope.RUNTIME,
  })
}
