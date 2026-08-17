import { SYSTEM } from '@func/contracts/core-errors'
import { hasModuleMetadata, moduleMetadata } from '../application/definition'
import type { ModuleInput } from '../application/definition'
import { InternalException, isException } from '../shared/errors'
import { isMultiProviderToken } from '../runtime/enhancers'
import type { ExplicitProvider, Provider, ProviderToken } from './types'
import {
  isProviderToken,
  normalizeProvider,
  providerTokenName,
} from './provider-utils'

export interface ProviderRecord {
  definition: ExplicitProvider
  kind: 'option' | 'provider'
  owner: CompiledModule
  token: ProviderToken
}

export interface CompiledModule {
  exports: Map<ProviderToken, ProviderRecord | readonly ProviderRecord[]>
  imports: CompiledModule[]
  input: ModuleInput
  multiProviders: Map<ProviderToken, ProviderRecord[]>
  name: string
  options: ProviderRecord[]
  providers: Map<ProviderToken, ProviderRecord>
}

export interface CompiledGraph {
  modules: readonly CompiledModule[]
  root: CompiledModule
}

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
    const providers = metadata.providers ?? []
    registerProviders(
      compiled,
      providers.filter(provider => !isMultiProvider(provider)),
    )
    registerMultiProviders(compiled, providers.filter(isMultiProvider))

    ;(metadata.exports ?? []).forEach(token => {
      const multi = isProviderToken(token) && isMultiProviderToken(token)
      const records = multi ? providerRecords(compiled, token) : []
      const exported = multi
        ? records.length
          ? records
          : undefined
        : isProviderToken(token)
          ? providerRecord(compiled, token)
          : undefined
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
    let normalized
    try {
      normalized = normalizeProvider(provider)
    } catch (error) {
      if (isException(error)) error.details.module = owner.name
      throw error
    }

    if (
      owner.providers.has(normalized.token) ||
      owner.multiProviders.has(normalized.token)
    ) {
      throw new InternalException(SYSTEM.DUPLICATE_PROVIDER, {
        details: {
          module: owner.name,
          token: providerTokenName(normalized.token),
        },
      })
    }

    const record: ProviderRecord = {
      definition: normalized.definition,
      kind,
      owner,
      token: normalized.token,
    }
    owner.providers.set(normalized.token, record)
    if (kind === 'option') owner.options.push(record)
    return record
  })

export const providerRecord = (
  requester: CompiledModule,
  token: ProviderToken,
): ProviderRecord | undefined => {
  const local = requester.providers.get(token)
  if (local) return local
  let matched: ProviderRecord | undefined

  requester.imports.forEach(imported => {
    const exported = imported.exports.get(token)
    const candidate = isProviderRecordList(exported) ? undefined : exported
    if (!candidate || candidate === matched) return
    if (!matched) {
      matched = candidate
      return
    }

    throw new InternalException(SYSTEM.DUPLICATE_PROVIDER, {
      details: {
        module: requester.name,
        providers: [matched.owner.name, candidate.owner.name],
        token: providerTokenName(token),
      },
    })
  })

  return matched
}

export const registerMultiProviders = (
  owner: CompiledModule,
  providers: readonly Provider[],
): ProviderRecord[] =>
  providers.map(provider => {
    let normalized
    try {
      normalized = normalizeProvider(provider)
    } catch (error) {
      if (isException(error)) error.details.module = owner.name
      throw error
    }

    if (owner.providers.has(normalized.token)) {
      throw new InternalException(SYSTEM.DUPLICATE_PROVIDER, {
        details: {
          module: owner.name,
          token: providerTokenName(normalized.token),
        },
      })
    }

    const record: ProviderRecord = {
      definition: normalized.definition,
      kind: 'provider',
      owner,
      token: normalized.token,
    }
    const records = owner.multiProviders.get(normalized.token) ?? []
    records.push(record)
    owner.multiProviders.set(normalized.token, records)
    return record
  })

export const providerRecords = (
  requester: CompiledModule,
  token: ProviderToken,
): readonly ProviderRecord[] => {
  const records = (requester.multiProviders.get(token) ?? []).slice()
  requester.imports.forEach(imported => {
    const exported = imported.exports.get(token)
    if (isProviderRecordList(exported)) records.push(...exported)
  })
  return records
}

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

const isProviderRecordList = (
  value: ProviderRecord | readonly ProviderRecord[] | undefined,
): value is readonly ProviderRecord[] => Array.isArray(value)

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
