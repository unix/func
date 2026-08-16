import { RUNTIME_PRINT } from '@func/contracts/core-errors'
import type { UserOption, UserOptionValue } from './types'
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
      ? options[data.name]
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
  [propertyKey: string]: UserOptionValue
}

const fieldTarget = (value: unknown): FieldTarget => {
  if (isFieldTarget(value)) return value
  throw new TypeError('Field options can only be bound to an object instance.')
}

const isFieldTarget = (value: unknown): value is FieldTarget =>
  typeof value === 'object' && value !== null

const validateRequiredFields = (
  fieldOptions: readonly CompiledFieldOption[],
  options: UserOption,
) => {
  fieldOptions.forEach(data => {
    if (data.required && options[data.name] === undefined) {
      throw new InternalException(RUNTIME_PRINT.VALIDATION, {
        details: { option: data.name },
        message: `Option "--${data.name}" is required.`,
        scope: ErrorScope.RUNTIME_PRINT,
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
          throw new InternalException(RUNTIME_PRINT.VALIDATION, {
            details: { option: data.name, value: options[data.name] },
            message:
              typeof result === 'string'
                ? result
                : `Option "--${data.name}" is invalid.`,
            scope: ErrorScope.RUNTIME_PRINT,
          })
        }
      } catch (error) {
        if (isException(error)) throw error

        throw new InternalException(RUNTIME_PRINT.VALIDATION, {
          cause: error instanceof Error ? error : undefined,
          details: { option: data.name, value: options[data.name] },
          message: error instanceof Error ? error.message : String(error),
          scope: ErrorScope.RUNTIME_PRINT,
        })
      }
    })
  })
}
