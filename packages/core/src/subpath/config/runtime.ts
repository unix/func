import { RUNTIME, SYSTEM } from '@func/contracts/config-errors'
import { ErrorScope, InternalException } from '../../shared/errors'
import { configFileExists, readConfigFile, writeConfigFile } from './file-store'
import type { ConfigBinding } from './file-store'
import type {
  ConfigConstructor,
  ConfigDefaults,
  ConfigInstance,
  JsonValue,
} from './interfaces'
import { assertJsonValue, cloneConfig, mergeConfig } from './schema'

export type { ConfigBinding } from './file-store'

type InferredConfig<T> = T extends boolean
  ? boolean
  : T extends JsonValue[]
    ? InferredConfig<T[number]>[]
    : T extends ConfigDefaults
      ? { [K in keyof T]: InferredConfig<T[K]> }
      : T

abstract class ConfigRuntime<T extends ConfigDefaults> implements ConfigInstance<T> {
  private binding?: ConfigBinding
  private data?: T
  private readonly defaults: T

  constructor(defaults: T) {
    this.defaults = cloneConfig(defaults)
  }

  get<K extends Extract<keyof T, string>>(key: K): T[K] {
    this.assertKey(key)
    return cloneConfig(this.load()[key])
  }

  getAll(): Readonly<T> {
    return cloneConfig(this.load())
  }

  reset<K extends Extract<keyof T, string>>(key: K): void {
    this.assertKey(key)
    const next = assign(this.load(), key, cloneConfig(this.defaults[key]))
    this.save(next)
  }

  resetAll(): void {
    this.save(cloneConfig(this.defaults))
  }

  set<K extends Extract<keyof T, string>>(key: K, value: T[K]): void {
    this.assertKey(key)
    assertJsonValue(value, `Config value "${key}"`)
    const next = assign(this.load(), key, cloneConfig(value))
    this.save(next)
  }

  bind(binding: ConfigBinding) {
    this.binding = { ...binding }
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
    if (configFileExists(binding)) return false
    writeConfigFile(binding, this.defaults)
    return true
  }

  private load(): T {
    if (this.data) return this.data
    const binding = this.bindingOrThrow()
    if (this.createFileIfMissing(binding)) {
      this.data = cloneConfig(this.defaults)
      return this.data
    }

    const stored = readConfigFile(binding)
    this.data = mergeConfig(this.defaults, stored, binding.filePath)
    return this.data
  }

  private save(data: T) {
    const binding = this.bindingOrThrow()
    writeConfigFile(binding, data)
    this.data = cloneConfig(data)
  }
}

export const Config = <T extends ConfigDefaults>(
  defaults: T,
): ConfigConstructor<InferredConfig<T>> => {
  assertJsonValue(defaults, 'Config defaults')
  // InferredConfig widens boolean literals without changing runtime data.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const snapshot = cloneConfig(defaults) as InferredConfig<T>

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
  const result = cloneConfig(source)
  Object.defineProperty(result, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
  return result
}
