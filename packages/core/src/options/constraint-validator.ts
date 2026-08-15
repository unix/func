import { RUNTIME_PRINT } from '@func/shared/core-errors'
import type {
  FieldOptionParams,
  UserOption,
  UserOptionEnumValue,
} from '../interfaces'
import { ErrorScope, InternalException } from '../shared/errors'

export class ConstraintValidator {
  constructor(
    private readonly fieldOptions: readonly FieldOptionParams[],
    private readonly option: UserOption,
    private readonly supplied: ReadonlySet<string>,
  ) {}

  validate() {
    const explicitNames = this.explicitNames()
    this.fieldOptions.forEach(data => {
      this.validateEnum(data)
      this.validateDependsOn(data, explicitNames)
      this.validateExclusive(data, explicitNames)
    })
  }

  private explicitNames(): Set<string> {
    return new Set(
      this.fieldOptions
        .filter(data => this.supplied.has(data.name))
        .map(data => data.name),
    )
  }

  private validateDependsOn(data: FieldOptionParams, explicitNames: Set<string>) {
    if (!data.dependsOn?.length) return
    if (!explicitNames.has(data.name)) return
    const missing = data.dependsOn.filter(item => !explicitNames.has(item))
    if (!missing.length) return

    throw new InternalException(RUNTIME_PRINT.VALIDATION, {
      details: { dependsOn: data.dependsOn, missing, option: data.name },
      message: `Option "--${data.name}" depends on: ${missing.map(item => `--${item}`).join(', ')}.`,
      scope: ErrorScope.RUNTIME_PRINT,
    })
  }

  private validateEnum(data: FieldOptionParams) {
    const enumValues = data.enum
    if (!enumValues?.length) return
    const value = this.option[data.name]
    if (value === undefined) return
    const values = Array.isArray(value) ? value : [value]
    const invalid = values.filter(
      item => !enumValues.includes(item as UserOptionEnumValue),
    )
    if (!invalid.length) return

    throw new InternalException(RUNTIME_PRINT.VALIDATION, {
      details: { enum: enumValues, invalid, option: data.name },
      message: `Option "--${data.name}" must be one of: ${enumValues.join(', ')}.`,
      scope: ErrorScope.RUNTIME_PRINT,
    })
  }

  private validateExclusive(data: FieldOptionParams, explicitNames: Set<string>) {
    if (!data.exclusive?.length) return
    if (!explicitNames.has(data.name)) return
    const conflicts = data.exclusive.filter(item => explicitNames.has(item))
    if (!conflicts.length) return

    throw new InternalException(RUNTIME_PRINT.VALIDATION, {
      details: { conflicts, exclusive: data.exclusive, option: data.name },
      message: `Option "--${data.name}" cannot be used with: ${conflicts.map(item => `--${item}`).join(', ')}.`,
      scope: ErrorScope.RUNTIME_PRINT,
    })
  }
}
