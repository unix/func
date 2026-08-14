import type arg from 'arg'
import { RUNTIME_PRINT } from '@func/shared/core-errors'
import type { UserOption } from '../interfaces'
import { ErrorScope, InternalException, isException } from '../shared/errors'
import { ConstraintValidator } from './constraint-validator'
import type { CompiledFieldOption } from './field-metadata'

interface FieldBindingParams {
  args: arg.Result<any>
  fieldOptions: CompiledFieldOption[]
  instance: any
  nativeOption: UserOption
}

export const bindFieldOptions = ({
  args,
  fieldOptions,
  instance,
  nativeOption,
}: FieldBindingParams) => {
  bindFieldValues(fieldOptions, instance, args, nativeOption)
  validateRequiredFields(fieldOptions, nativeOption)
  validateFieldValues(fieldOptions, nativeOption)
  new ConstraintValidator(fieldOptions, args, nativeOption).validate()
}

export const hydrateFieldOptions = ({
  args,
  fieldOptions,
  instance,
  nativeOption,
}: FieldBindingParams) => {
  bindFieldValues(fieldOptions, instance, args, nativeOption)
}

const bindFieldValues = (
  fieldOptions: CompiledFieldOption[],
  instance: any,
  args: arg.Result<any>,
  nativeOption: UserOption,
) => {
  fieldOptions.forEach(data => {
    const key = `--${data.name}`
    const hasValue = Object.prototype.hasOwnProperty.call(args, key)
    const hasDefault = Object.prototype.hasOwnProperty.call(
      instance,
      data.propertyKey,
    )
    const value = hasValue
      ? args[key]
      : hasDefault
        ? instance[data.propertyKey]
        : undefined
    Object.defineProperty(instance, data.propertyKey, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    })
    nativeOption[data.name] = value
  })
}

const validateRequiredFields = (
  fieldOptions: CompiledFieldOption[],
  nativeOption: UserOption,
) => {
  fieldOptions.forEach(data => {
    if (data.required && nativeOption[data.name] === undefined) {
      throw new InternalException(RUNTIME_PRINT.VALIDATION, {
        details: { option: data.name },
        message: `Option "--${data.name}" is required.`,
        scope: ErrorScope.RUNTIME_PRINT,
      })
    }
  })
}

const validateFieldValues = (
  fieldOptions: CompiledFieldOption[],
  nativeOption: UserOption,
) => {
  fieldOptions.forEach(data => {
    data.validators.forEach(fn => {
      try {
        const result = fn(nativeOption[data.name], nativeOption)
        if (result === false || typeof result === 'string') {
          throw new InternalException(RUNTIME_PRINT.VALIDATION, {
            details: { option: data.name, value: nativeOption[data.name] },
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
          details: { option: data.name, value: nativeOption[data.name] },
          message: error instanceof Error ? error.message : String(error),
          scope: ErrorScope.RUNTIME_PRINT,
        })
      }
    })
  })
}
