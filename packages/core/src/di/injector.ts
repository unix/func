import 'reflect-metadata/lite'
import { RUNTIME, SYSTEM } from '@func/contracts/core-errors'
import { ErrorScope, InternalException, isException } from '../shared/errors'
import { metadata } from './metadata'
import { parameterTokens } from './decorators'
import { hasOnDispose, hasOnInit } from './lifecycle'
import type { LifecycleFault } from './lifecycle'
import { providerRecord } from './module-compiler'
import type {
  CompiledGraph,
  CompiledModule,
  ProviderRecord,
} from './module-compiler'
import type { FactoryProvider, ProviderToken, Type } from './types'
import { isProviderToken, providerTokenName } from './provider-utils'

interface OwnedProvider {
  instance: unknown
  record: ProviderRecord
}

export class RuntimeInjector {
  private activeOptions = new Set<ProviderRecord>()
  private initializedOptions = new Set<ProviderRecord>()
  private instances = new Map<ProviderRecord, Promise<unknown>>()
  private ownedProviders: OwnedProvider[] = []
  private ownedInstanceSet = new Set<unknown>()
  private values: ReadonlyMap<ProviderToken, unknown>

  constructor(
    private graph: CompiledGraph,
    values: ReadonlyMap<ProviderToken, unknown> = new Map(),
  ) {
    this.values = values
  }

  async instantiate<T>(target: Type<T>, requester = this.graph.root): Promise<T> {
    const params = await this.parameters(target, undefined, requester)
    return this.construct(target, params)
  }

  async activateOption(
    record: ProviderRecord,
    prepare: (instance: unknown) => Promise<void> | void,
  ): Promise<unknown> {
    this.activeOptions.add(record)
    const instance = await this.optionInstance(record)
    if (this.initializedOptions.has(record)) return instance
    try {
      await prepare(instance)
      if (this.ownedInstanceSet.has(instance) && hasOnInit(instance)) {
        await instance.onInit()
      }
      this.initializedOptions.add(record)
      return instance
    } catch (error) {
      throw this.providerInitError(error, record)
    }
  }

  async activateProvider(record: ProviderRecord): Promise<unknown> {
    const cached = this.instances.get(record)
    if (cached) return cached
    const creation = this.create(record, [])
    this.instances.set(record, creation)
    return creation
  }

  allowOptions(records: readonly ProviderRecord[]): void {
    records.forEach(record => this.activeOptions.add(record))
  }

  parameters(
    target: object | Type,
    propertyKey: string | undefined,
    requester = this.graph.root,
  ): Promise<unknown[]> {
    return this.resolveParameters(target, propertyKey, requester, [])
  }

  async dispose(): Promise<LifecycleFault[]> {
    const faults: LifecycleFault[] = []
    const providers = this.ownedProviders.slice().reverse()
    this.ownedProviders = []
    this.ownedInstanceSet.clear()
    this.activeOptions.clear()
    this.initializedOptions.clear()
    this.instances.clear()

    for (const { instance, record } of providers) {
      if (!hasOnDispose(instance)) continue
      try {
        await instance.onDispose()
      } catch (error) {
        faults.push({
          error: normalizeError(error),
          kind: 'provider',
          name: providerTokenName(record.token),
        })
      }
    }

    return faults
  }

  private resolve(
    token: ProviderToken,
    requester: CompiledModule,
    dependencyPath: ProviderRecord[],
  ): Promise<unknown> {
    if (this.values.has(token)) return Promise.resolve(this.values.get(token))
    const record = this.sourceRecord(token, requester, dependencyPath)
    this.throwIfCircular(record, dependencyPath)
    const cached = this.instances.get(record)
    if (cached) return cached
    if (record.kind === 'option') {
      if (!this.activeOptions.has(record)) {
        throw new InternalException(SYSTEM.MISSING_PROVIDER, {
          details: {
            requester: requester.name,
            token: providerTokenName(token),
          },
        })
      }

      const creation = this.create(record, dependencyPath, false)
      this.instances.set(record, creation)
      return creation
    }
    const creation = this.create(record, dependencyPath)
    this.instances.set(record, creation)
    return creation
  }

  private async create(
    record: ProviderRecord,
    dependencyPath: ProviderRecord[],
    initialize = true,
  ): Promise<unknown> {
    const nextPath = dependencyPath.concat([record])
    const definition = record.definition
    try {
      if ('useValue' in definition) return definition.useValue
      let instance: unknown
      if ('useClass' in definition) {
        const params = await this.resolveParameters(
          definition.useClass,
          undefined,
          record.owner,
          nextPath,
        )
        instance = this.construct(definition.useClass, params)
      } else {
        const dependencies = await this.factoryDependencies(
          definition,
          record,
          nextPath,
        )
        const result: unknown = Reflect.apply(
          definition.useFactory,
          undefined,
          dependencies,
        )
        instance = await result
      }

      const owned = this.own(instance, record)
      if (initialize && owned && hasOnInit(instance)) await instance.onInit()
      return instance
    } catch (error) {
      throw this.providerInitError(error, record)
    }
  }

  private optionInstance(record: ProviderRecord): Promise<unknown> {
    const cached = this.instances.get(record)
    if (cached) return cached
    const creation = this.create(record, [], false)
    this.instances.set(record, creation)
    return creation
  }

  private providerInitError(error: unknown, record: ProviderRecord): Error {
    if (isException(error)) return error
    const cause = error instanceof Error ? error : undefined
    return new InternalException(RUNTIME.PROVIDER_INIT, {
      cause,
      details: {
        module: record.owner.name,
        token: providerTokenName(record.token),
      },
      message:
        cause?.message ??
        `Provider "${providerTokenName(record.token)}" initialization failed.`,
      scope: ErrorScope.RUNTIME,
    })
  }

  private async factoryDependencies(
    definition: FactoryProvider,
    record: ProviderRecord,
    dependencyPath: ProviderRecord[],
  ): Promise<unknown[]> {
    const dependencies: unknown[] = []
    for (const token of definition.inject ?? []) {
      dependencies.push(await this.resolve(token, record.owner, dependencyPath))
    }

    return dependencies
  }

  private async resolveParameters(
    target: object | Type,
    propertyKey: string | undefined,
    requester: CompiledModule,
    dependencyPath: ProviderRecord[],
  ): Promise<unknown[]> {
    const explicitTokens = parameterTokens(target, propertyKey)
    const inferredTokens = this.paramTypes(target, propertyKey)
    const length = Math.max(
      this.declaredParamCount(target, propertyKey),
      inferredTokens.length,
      ...Object.keys(explicitTokens).map(item => Number(item) + 1),
    )
    const parameters: unknown[] = []

    for (let index = 0; index < length; index += 1) {
      const token = explicitTokens[index] ?? inferredTokens[index]
      if (token) {
        parameters.push(await this.resolve(token, requester, dependencyPath))
        continue
      }

      throw new InternalException(SYSTEM.MISSING_PARAM_TYPES, {
        details: {
          index,
          target: this.targetName(target, propertyKey),
        },
      })
    }

    return parameters
  }

  private sourceRecord(
    token: ProviderToken,
    requester: CompiledModule,
    dependencyPath: ProviderRecord[],
  ): ProviderRecord {
    const record = providerRecord(requester, token) ?? this.rootOptionRecord(token)
    if (record) return record
    throw new InternalException(SYSTEM.MISSING_PROVIDER, {
      details: {
        dependencyPath: dependencyPath
          .map(item => providerTokenName(item.token))
          .concat([providerTokenName(token)]),
        requester: requester.name,
        token: providerTokenName(token),
      },
    })
  }

  private rootOptionRecord(token: ProviderToken): ProviderRecord | undefined {
    const record = this.graph.root.providers.get(token)
    return record?.kind === 'option' ? record : undefined
  }

  private throwIfCircular(record: ProviderRecord, dependencyPath: ProviderRecord[]) {
    if (!dependencyPath.includes(record)) return
    const path = dependencyPath
      .concat([record])
      .map(item => providerTokenName(item.token))
    throw new InternalException(SYSTEM.CIRCULAR_PROVIDER_DEPENDENCY, {
      details: {
        dependencyPath: path,
        token: providerTokenName(record.token),
      },
    })
  }

  private own(instance: unknown, record: ProviderRecord): boolean {
    if (
      !instance ||
      (typeof instance !== 'object' && typeof instance !== 'function') ||
      this.ownedInstanceSet.has(instance)
    ) {
      return false
    }

    this.ownedInstanceSet.add(instance)
    this.ownedProviders.push({ instance, record })
    return true
  }

  private paramTypes(
    target: object | Type,
    propertyKey?: string,
  ): Array<ProviderToken | undefined> {
    const value: unknown = propertyKey
      ? Reflect.getMetadata(metadata.DESIGN_PARAM_TYPES, target, propertyKey)
      : Reflect.getMetadata(metadata.DESIGN_PARAM_TYPES, target)
    return isParameterTypeList(value) ? value : []
  }

  private declaredParamCount(target: object | Type, propertyKey?: string): number {
    if (!propertyKey && typeof target === 'function') return target.length
    if (!propertyKey) return 0
    const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey)
    const method: unknown = descriptor?.value
    return typeof method === 'function' ? method.length : 0
  }

  private targetName(target: object | Type, propertyKey?: string): string {
    if (propertyKey) {
      const name = target.constructor.name
      return `${name || '(anonymous class)'}.${propertyKey}`
    }

    if (typeof target === 'function') return target.name || '(anonymous class)'
    return target.constructor.name || '(anonymous class)'
  }

  private construct<T>(target: Type<T>, params: unknown[]): T {
    const instance: unknown = Reflect.construct(target, params)
    if (instance instanceof target) return instance
    throw new TypeError(`Failed to construct "${target.name}".`)
  }
}

const isParameterTypeList = (
  value: unknown,
): value is Array<ProviderToken | undefined> =>
  isUnknownArray(value) &&
  value.every(item => item === undefined || isProviderToken(item))

const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value)

const normalizeError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error))
