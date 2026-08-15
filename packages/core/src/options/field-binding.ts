import { RUNTIME_PRINT } from '@func/shared/core-errors'
import type { UserOption } from '../interfaces'
import { ErrorScope, InternalException, isException } from '../shared/errors'
import { ConstraintValidator } from './constraint-validator'
import type { CompiledFieldOption } from './field-metadata'

interface FieldBindingParams {
  fieldOptions: readonly CompiledFieldOption[]
  instance: any
  options: UserOption
  supplied: ReadonlySet<string>
}

export const bindFieldOptions = ({
  fieldOptions,
  instance,
  options,
  supplied,
}: FieldBindingParams) => {
  bindFieldValues(fieldOptions, instance, options, supplied)
  validateRequiredFields(fieldOptions, options)
  validateFieldValues(fieldOptions, options)
  new ConstraintValidator(fieldOptions, options, supplied).validate()
}

export const hydrateFieldOptions = ({
  fieldOptions,
  instance,
  options,
  supplied,
}: FieldBindingParams) => {
  bindFieldValues(fieldOptions, instance, options, supplied)
}

const bindFieldValues = (
  fieldOptions: readonly CompiledFieldOption[],
  instance: any,
  options: UserOption,
  supplied: ReadonlySet<string>,
) => {
  fieldOptions.forEach(data => {
    const hasDefault = Object.prototype.hasOwnProperty.call(
      instance,
      data.propertyKey,
    )
    const value = supplied.has(data.name)
      ? options[data.name]
      : hasDefault
        ? instance[data.propertyKey]
        : undefined
    Object.defineProperty(instance, data.propertyKey, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    })
    options[data.name] = value
  })
}

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
