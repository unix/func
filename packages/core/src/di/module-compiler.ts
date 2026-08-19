import { SYSTEM } from '@func/contracts/core-errors'
import { hasModuleMetadata, moduleMetadata } from '../application/definition'
import type { ModuleInput } from '../application/definition'
import { InternalException, isException } from '../shared/errors'
import { isMultiProviderToken } from '../options/module-option'
import type { NormalizedProvider, Provider, ProviderToken } from './types'
import type { CompiledGraph, CompiledModule, ProviderRecord } from './module-graph'
import { providerRecord, providerRecords } from './module-graph'
import {
  isProviderToken,
  normalizeProvider,
  providerTokenName,
} from './provider-utils'

export type { CompiledGraph, CompiledModule, ProviderRecord } from './module-graph'
export { providerRecord, providerRecords } from './module-graph'

interface CompilerState {
  cache: Map<ModuleInput, CompiledModule>
  modules: CompiledModule[]
  stack: ModuleInput[]
}

export const compileModules = (input: ModuleInput): CompiledGraph => {
  const state: CompilerState = {
    cache: new Map(),
    modules: [],
    stack: [],
  }
  const root = compileModule(input, state)
  return { modules: state.modules, root }
}

const compileModule = (input: ModuleInput, state: CompilerState): CompiledModule => {
  validateModuleInput(input)
  const circularIndex = state.stack.indexOf(input)
  if (circularIndex >= 0) {
    const dependencyPath = state.stack
      .slice(circularIndex)
      .concat([input])
      .map(moduleName)
    throw new InternalException(SYSTEM.CIRCULAR_MODULE_IMPORT, {
      details: { dependencyPath },
    })
  }

  const cached = state.cache.get(input)
  if (cached) return cached
  const metadata = moduleMetadata(input)
  const compiled: CompiledModule = {
    exports: new Map(),
    imports: [],
    input,
    multiProviders: new Map(),
    name: moduleName(input),
    options: [],
    providers: new Map(),
  }
  state.cache.set(input, compiled)
  state.stack.push(input)

  try {
    compiled.imports = (metadata.imports ?? []).map(imported =>
      compileModule(imported, state),
    )
    const providers: Provider[] = []
    const multiProviders: Provider[] = []
    ;(metadata.providers ?? []).forEach(provider => {
      if (isMultiProvider(provider)) {
        multiProviders.push(provider)
        return
      }
      providers.push(provider)
    })
    registerProviders(compiled, providers)
    registerMultiProviders(compiled, multiProviders)

    ;(metadata.exports ?? []).forEach(token => {
      let exported: ProviderRecord | readonly ProviderRecord[] | undefined
      if (isProviderToken(token)) {
        if (isMultiProviderToken(token)) {
          const records = providerRecords(compiled, token)
          exported = records.length ? records : undefined
        } else {
          exported = providerRecord(compiled, token)
        }
      }
      if (!exported) {
        throw new InternalException(SYSTEM.INVALID_MODULE_EXPORT, {
          details: {
            module: compiled.name,
            token: providerName(token),
          },
        })
      }
      compiled.exports.set(token, exported)
    })

    state.modules.push(compiled)
    return compiled
  } finally {
    state.stack.pop()
  }
}

const validateModuleInput = (input: ModuleInput) => {
  if (typeof input !== 'function' || hasModuleMetadata(input)) return
  const module = input.name || '(anonymous class)'
  throw new InternalException(SYSTEM.INVALID_MODULE_INPUT, {
    details: { module },
  })
}

export const registerProviders = (
  owner: CompiledModule,
  providers: readonly Provider[],
  kind: ProviderRecord['kind'] = 'provider',
): ProviderRecord[] =>
  providers.map(provider => {
    const normalized = normalizeOwnedProvider(owner, provider)
    assertProviderAvailable(owner, normalized.token, false)
    const record = createProviderRecord(owner, normalized, kind)
    owner.providers.set(normalized.token, record)
    if (kind === 'option') owner.options.push(record)
    return record
  })

export const registerMultiProviders = (
  owner: CompiledModule,
  providers: readonly Provider[],
): ProviderRecord[] =>
  providers.map(provider => {
    const normalized = normalizeOwnedProvider(owner, provider)
    assertProviderAvailable(owner, normalized.token, true)
    const record = createProviderRecord(owner, normalized, 'provider')
    const records = owner.multiProviders.get(normalized.token) ?? []
    records.push(record)
    owner.multiProviders.set(normalized.token, records)
    return record
  })

const normalizeOwnedProvider = (
  owner: CompiledModule,
  provider: Provider,
): NormalizedProvider => {
  try {
    return normalizeProvider(provider)
  } catch (error) {
    if (isException(error)) error.details.module = owner.name
    throw error
  }
}

const assertProviderAvailable = (
  owner: CompiledModule,
  token: ProviderToken,
  multiple: boolean,
) => {
  if (!owner.providers.has(token) && (multiple || !owner.multiProviders.has(token)))
    return
  throw new InternalException(SYSTEM.DUPLICATE_PROVIDER, {
    details: {
      module: owner.name,
      token: providerTokenName(token),
    },
  })
}

const createProviderRecord = (
  owner: CompiledModule,
  provider: NormalizedProvider,
  kind: ProviderRecord['kind'],
): ProviderRecord => ({
  definition: provider.definition,
  kind,
  owner,
  token: provider.token,
})

const moduleName = (input: ModuleInput): string => {
  const metadata = moduleMetadata(input)
  if (metadata.name) return metadata.name
  if (typeof input === 'function') return input.name || '(anonymous module)'
  return '(module config)'
}

const providerName = (token: unknown): string => {
  if (isProviderToken(token)) return providerTokenName(token)
  return String(token)
}

const isMultiProvider = (provider: unknown): boolean => {
  if (
    typeof provider !== 'object' ||
    provider === null ||
    !('provide' in provider)
  ) {
    return false
  }
  const token = Reflect.get(provider, 'provide')
  return isProviderToken(token) && isMultiProviderToken(token)
}
