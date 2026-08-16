import { RUNTIME, SYSTEM } from '@func/contracts/config-errors'
import { ErrorScope, InternalException } from '../../shared/errors'
import type { ConfigDefaults, JsonValue } from './interfaces'

export type ConfigRecord = Record<string, JsonValue>

type AssertJsonValue = (
  value: unknown,
  label: string,
  ancestors?: Set<object>,
) => asserts value is JsonValue

export const cloneConfig = <T>(value: T): T => structuredClone(value)

export const mergeConfig = <T extends ConfigDefaults>(
  defaults: T,
  stored: ConfigRecord,
  filePath: string,
  keyPath: readonly string[] = [],
): T => {
  const result = cloneConfig(defaults)
  Object.keys(defaults).forEach(key => {
    if (!Object.hasOwn(stored, key)) return
    const defaultValue = defaults[key]
    const storedValue = stored[key]
    const nextKeyPath = [...keyPath, key]
    const expectedType = configValueType(defaultValue)
    const actualType = configValueType(storedValue)
    if (actualType !== expectedType) {
      throw new InternalException(RUNTIME.FILE_SCHEMA, {
        details: {
          actualType,
          expectedType,
          key: nextKeyPath.join('.'),
          path: filePath,
        },
        message: `Config value "${nextKeyPath.join('.')}" in "${filePath}" must have type "${expectedType}", received "${actualType}".`,
        scope: ErrorScope.RUNTIME,
      })
    }
    const value =
      isConfigRecord(defaultValue) && isConfigRecord(storedValue)
        ? mergeConfig(defaultValue, storedValue, filePath, nextKeyPath)
        : cloneConfig(storedValue)
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    })
  })
  return result
}

export const assertJsonValue: AssertJsonValue = (
  value: unknown,
  label: string,
  ancestors = new Set<object>(),
): asserts value is JsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return
  if (typeof value === 'number' && Number.isFinite(value)) return
  if (!value || typeof value !== 'object') {
    throw new InternalException(
      SYSTEM.DEFINITION,
      `${label} must be JSON serializable.`,
    )
  }
  if (ancestors.has(value)) {
    throw new InternalException(
      SYSTEM.DEFINITION,
      `${label} cannot contain circular references.`,
    )
  }

  const nextAncestors = new Set(ancestors).add(value)
  if (Array.isArray(value)) {
    value.forEach(item => assertJsonValue(item, label, nextAncestors))
    return
  }
  if (!isConfigRecord(value)) {
    throw new InternalException(
      SYSTEM.DEFINITION,
      `${label} must contain only plain objects.`,
    )
  }
  Object.values(value).forEach(item => assertJsonValue(item, label, nextAncestors))
}

export const isConfigRecord = (value: unknown): value is ConfigRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const configValueType = (value: JsonValue): string => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}
