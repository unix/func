export type JsonPrimitive = boolean | null | number | string

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type ConfigDefaults = Record<string, JsonValue>

export interface ConfigFileOptions {
  maxBytes?: number
  name: string
}

export interface ConfigInstance<T extends ConfigDefaults = ConfigDefaults> {
  get<K extends Extract<keyof T, string>>(key: K): T[K]
  getAll(): Readonly<T>
  reset<K extends Extract<keyof T, string>>(key: K): void
  resetAll(): void
  set<K extends Extract<keyof T, string>>(key: K, value: T[K]): void
}

export interface ConfigConstructor<T extends ConfigDefaults = ConfigDefaults> {
  new (): ConfigInstance<T>
}

export interface ConfigModuleOptions {
  appName: string
  configs: ConfigConstructor[]
}
