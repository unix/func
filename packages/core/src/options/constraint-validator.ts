import type arg from 'arg'
import {
  FieldOptionParams,
  UserOption,
} from '../interfaces'
import {
  F_RUNTIME_PRINT,
  createRuntimePrintError,
  errorTypes,
} from '../errors'

export class ConstraintValidator {
  constructor(
    private fieldOptions: FieldOptionParams[],
    private args: arg.Result<any>,
    private option: UserOption,
  ) {}

  validate() {
    this.fieldOptions.forEach(data => {
      this.validateEnum(data)
      this.validateDependsOn(data)
      this.validateExclusive(data)
    })
  }

  private explicitNames(): Set<string> {
    return new Set(
      this.fieldOptions
        .filter(data => Object.prototype.hasOwnProperty.call(this.args, `--${data.name}`))
        .map(data => data.name),
    )
  }

  private validateDependsOn(data: FieldOptionParams) {
    if (!data.dependsOn || !data.dependsOn.length) return

    const explicit = this.explicitNames()
    if (!explicit.has(data.name)) return

    const missing = data.dependsOn.filter(item => !explicit.has(item))
    if (!missing.length) return

    throw createRuntimePrintError(
      F_RUNTIME_PRINT.VALIDATION,
      errorTypes.INPUT,
      `Option "--${data.name}" depends on: ${missing.map(item => `--${item}`).join(', ')}.`,
      { option: data.name, dependsOn: data.dependsOn, missing },
    )
  }

  private validateEnum(data: FieldOptionParams) {
    if (!data.enum || !data.enum.length) return

    const value = this.option[data.name]
    if (value === undefined) return

    const values = Array.isArray(value) ? value : [value]
    const invalid = values.filter(item => !data.enum!.includes(item as any))
    if (!invalid.length) return

    throw createRuntimePrintError(
      F_RUNTIME_PRINT.VALIDATION,
      errorTypes.INPUT,
      `Option "--${data.name}" must be one of: ${data.enum.join(', ')}.`,
      { option: data.name, enum: data.enum, invalid },
    )
  }

  private validateExclusive(data: FieldOptionParams) {
    if (!data.exclusive || !data.exclusive.length) return

    const explicit = this.explicitNames()
    if (!explicit.has(data.name)) return

    const conflicts = data.exclusive.filter(item => explicit.has(item))
    if (!conflicts.length) return

    throw createRuntimePrintError(
      F_RUNTIME_PRINT.VALIDATION,
      errorTypes.INPUT,
      `Option "--${data.name}" cannot be used with: ${conflicts.map(item => `--${item}`).join(', ')}.`,
      { option: data.name, exclusive: data.exclusive, conflicts },
    )
  }
}
