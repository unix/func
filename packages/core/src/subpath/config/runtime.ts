import { RUNTIME, SYSTEM } from '@func/shared/config-errors'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ErrorScope, InternalException, isException } from '../../shared/errors'
import type {
  ConfigConstructor,
  ConfigDefaults,
  ConfigInstance,
  JsonValue,
} from './interfaces'

export interface ConfigBinding {
  filePath: string
  maxBytes?: number
}

type ConfigRecord = Record<string, JsonValue>

type InferredConfig<T> = T extends boolean
  ? boolean
  : T extends JsonValue[]
    ? InferredConfig<T[number]>[]
    : T extends ConfigDefaults
      ? { [K in keyof T]: InferredConfig<T[K]> }
      : T

type AssertJsonValue = (
  value: unknown,
  label: string,
  ancestors?: Set<object>,
) => asserts value is JsonValue

abstract class ConfigRuntime<T extends ConfigDefaults> implements ConfigInstance<T> {
  private binding?: ConfigBinding
  private data?: T
  private readonly defaults: T

  constructor(defaults: T) {
    this.defaults = clone(defaults)
  }

  get<K extends Extract<keyof T, string>>(key: K): T[K] {
    this.assertKey(key)
    return clone(this.load()[key])
  }

  getAll(): Readonly<T> {
    return clone(this.load())
  }

  reset<K extends Extract<keyof T, string>>(key: K): void {
    this.assertKey(key)
    const next = assign(this.load(), key, clone(this.defaults[key]))
    this.save(next)
  }

  resetAll(): void {
    this.save(clone(this.defaults))
  }

  set<K extends Extract<keyof T, string>>(key: K, value: T[K]): void {
    this.assertKey(key)
    assertJsonValue(value, `Config value "${key}"`)
    const next = assign(this.load(), key, clone(value))
    this.save(next)
  }

  bind(binding: ConfigBinding) {
    this.binding = Object.freeze({ ...binding })
  }

  private assertKey(key: string) {
    if (Object.hasOwn(this.defaults, key)) return
    throw new InternalException(RUNTIME.UNKNOWN_KEY, {
      details: { key },
      message: `Unknown config key "${key}".`,
      scope: ErrorScope.RUNTIME,
    })
  }

  private bindingOrThrow(): ConfigBinding {
    if (this.binding) return this.binding
    throw new InternalException(RUNTIME.NOT_REGISTERED, {
      message:
        'Config must be registered through ConfigModule.register() before use.',
      scope: ErrorScope.RUNTIME,
    })
  }

  private createFileIfMissing(binding: ConfigBinding): boolean {
    if (existsSync(binding.filePath)) return false
    this.write(binding, this.defaults)
    return true
  }

  private load(): T {
    if (this.data) return this.data
    const binding = this.bindingOrThrow()
    if (this.createFileIfMissing(binding)) {
      this.data = clone(this.defaults)
      return this.data
    }

    const stored = this.read(binding)
    this.data = merge(this.defaults, stored, binding.filePath)
    return this.data
  }

  private read(binding: ConfigBinding): ConfigRecord {
    let content: Buffer
    try {
      const size = statSync(binding.filePath).size
      this.assertMaxBytes(binding, size)
      content = readFileSync(binding.filePath)
      this.assertMaxBytes(binding, content.byteLength)
    } catch (error) {
      if (isException(error)) throw error
      throw new InternalException(RUNTIME.FILE_READ, {
        cause: nativeError(error),
        details: { path: binding.filePath },
        message: `Cannot read config file "${binding.filePath}".`,
        scope: ErrorScope.RUNTIME,
      })
    }

    try {
      // JSON.parse is typed as any; treat file content as unknown until checked.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const value = JSON.parse(content.toString('utf8')) as unknown
      if (!isPlainObject(value)) throw new TypeError('Expected a JSON object.')
      return value
    } catch (error) {
      throw new InternalException(RUNTIME.FILE_PARSE, {
        cause: nativeError(error),
        details: { path: binding.filePath },
        message: `Cannot parse config file "${binding.filePath}" as a JSON object.`,
        scope: ErrorScope.RUNTIME,
      })
    }
  }

  private save(data: T) {
    const binding = this.bindingOrThrow()
    this.write(binding, data)
    this.data = clone(data)
  }

  private write(binding: ConfigBinding, data: ConfigRecord) {
    let encoded: string
    try {
      encoded = `${JSON.stringify(data, null, 2)}\n`
    } catch (error) {
      throw new InternalException(RUNTIME.FILE_WRITE, {
        cause: nativeError(error),
        details: { path: binding.filePath },
        message: `Cannot write config file "${binding.filePath}".`,
        scope: ErrorScope.RUNTIME,
      })
    }
    this.assertMaxBytes(binding, Buffer.byteLength(encoded, 'utf8'))
    const directory = dirname(binding.filePath)
    const temporaryPath = `${binding.filePath}.${process.pid}.${randomUUID()}.tmp`
    try {
      mkdirSync(directory, { mode: 0o700, recursive: true })
      writeFileSync(temporaryPath, encoded, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      })
      renameSync(temporaryPath, binding.filePath)
    } catch (error) {
      removeTemporaryFile(temporaryPath)
      throw new InternalException(RUNTIME.FILE_WRITE, {
        cause: nativeError(error),
        details: { path: binding.filePath },
        message: `Cannot write config file "${binding.filePath}".`,
        scope: ErrorScope.RUNTIME,
      })
    }
  }

  private assertMaxBytes(binding: ConfigBinding, size: number) {
    if (binding.maxBytes === undefined || size <= binding.maxBytes) return
    throw new InternalException(RUNTIME.FILE_TOO_LARGE, {
      details: { maxBytes: binding.maxBytes, path: binding.filePath, size },
      message: `Config file "${binding.filePath}" is ${size} bytes and exceeds the ${binding.maxBytes} byte limit.`,
      scope: ErrorScope.RUNTIME,
    })
  }
}

export const Config = <T extends ConfigDefaults>(
  defaults: T,
): ConfigConstructor<InferredConfig<T>> => {
  assertJsonValue(defaults, 'Config defaults')
  // InferredConfig widens boolean literals without changing runtime data.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const snapshot = clone(defaults) as InferredConfig<T>

  return class extends ConfigRuntime<InferredConfig<T>> {
    constructor() {
      super(snapshot)
    }
  }
}

export const bindConfig = <T extends ConfigDefaults>(
  instance: ConfigInstance<T>,
  binding: ConfigBinding,
): ConfigInstance<T> => {
  if (!(instance instanceof ConfigRuntime)) {
    throw new InternalException(
      SYSTEM.DEFINITION,
      'Config provider must extend Config().',
    )
  }
  instance.bind(binding)
  return instance
}

export const isConfigConstructor = (config: unknown): config is ConfigConstructor =>
  typeof config === 'function' && config.prototype instanceof ConfigRuntime

const assign = <T extends ConfigDefaults, K extends Extract<keyof T, string>>(
  source: T,
  key: K,
  value: T[K],
): T => {
  const result = clone(source)
  Object.defineProperty(result, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
  return result
}

const clone = <T>(value: T): T => structuredClone(value)

const merge = <T extends ConfigDefaults>(
  defaults: T,
  stored: ConfigRecord,
  filePath: string,
  keyPath: readonly string[] = [],
): T => {
  const result = clone(defaults)
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
      isPlainObject(defaultValue) && isPlainObject(storedValue)
        ? merge(defaultValue, storedValue, filePath, nextKeyPath)
        : clone(storedValue)
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    })
  })
  return result
}

const configValueType = (value: JsonValue): string => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

const assertJsonValue: AssertJsonValue = (
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
  if (!isPlainObject(value)) {
    throw new InternalException(
      SYSTEM.DEFINITION,
      `${label} must contain only plain objects.`,
    )
  }
  Object.values(value).forEach(item => assertJsonValue(item, label, nextAncestors))
}

const isPlainObject = (value: unknown): value is ConfigRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const removeTemporaryFile = (filePath: string) => {
  try {
    unlinkSync(filePath)
  } catch {
    // Temporary-file cleanup must not replace the original write failure.
  }
}

const nativeError = (error: unknown): Error | undefined =>
  error instanceof Error ? error : undefined
