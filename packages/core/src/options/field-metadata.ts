import 'reflect-metadata/lite'
import type {
  CompiledFieldOptionParams,
  FieldOptionParams,
  UserOptionEnumValue,
  ValueTransform,
  ValueValidator,
} from './types'
import { SYSTEM } from '@func/contracts/core-errors'
import type { Deprecation } from '../deprecation'
import { InternalException } from '../shared/errors'
import { metadataValue } from '../shared/metadata-value'
import { metadata } from './metadata'

export interface FieldConstraints {
  enum?: UserOptionEnumValue[]
  dependsOn?: string[]
  exclusive?: string[]
}

interface FieldMetadataEntry {
  constraints: FieldConstraints
  deprecated?: Deprecation
  options: FieldMetadataOption[]
  override: boolean
  required: boolean
  validators: ValueValidator[]
}

interface FieldMetadataOption {
  option: FieldOptionParams
  transform?: ValueTransform
}

export type CompiledFieldOption = CompiledFieldOptionParams & {
  transform?: ValueTransform
  validators: readonly ValueValidator[]
}

type FieldMetadataUpdater = (entry: FieldMetadataEntry) => FieldMetadataEntry

export const updateFieldMetadata = (
  target: Object,
  propertyKey: string,
  update: FieldMetadataUpdater,
) => {
  const fields = new Map(fieldMetadata(target.constructor))
  const current = fields.get(propertyKey) ?? {
    constraints: {},
    options: [],
    override: false,
    required: false,
    validators: [],
  }
  fields.set(propertyKey, update(current))
  Reflect.defineMetadata(
    metadata.FIELD_OPTION_IDENTIFIER,
    fields,
    target.constructor,
  )
}

export const compileFieldOptions = (target: Function): CompiledFieldOption[] =>
  Array.from(fieldMetadata(target).entries()).flatMap(([propertyKey, field]) => {
    if (field.override && field.options.length !== 1) {
      throw new InternalException(SYSTEM.INVALID_OVERRIDE_TARGET, {
        details: {
          className: target.name || '(anonymous class)',
          options: field.options.map(({ option }) => option.name),
          property: propertyKey,
        },
      })
    }

    return field.options.map(({ option, transform }) => ({
      ...option,
      ...field.constraints,
      ...(field.deprecated ? { deprecated: field.deprecated } : {}),
      ...(field.override ? { override: true } : {}),
      ...(transform ? { transform } : {}),
      required: field.required,
      validators: field.validators.slice(),
    }))
  })

const fieldMetadata = (target: Function): ReadonlyMap<string, FieldMetadataEntry> =>
  metadataValue<ReadonlyMap<string, FieldMetadataEntry>>(
    metadata.FIELD_OPTION_IDENTIFIER,
    target,
  ) ?? new Map()
