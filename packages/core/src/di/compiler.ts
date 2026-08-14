import { SYSTEM } from '@func/shared/core-errors'
import { hasModuleMetadata, moduleMetadata } from '../application/module-definition'
import type { ModuleInput } from '../application/module-definition'
import { InternalException, isException } from '../shared/errors'
import type { ExplicitProvider, Provider, ProviderToken } from './provider'
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
  exports: Map<ProviderToken, ProviderRecord>
  imports: CompiledModule[]
  input: ModuleInput
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
  return { modules: Object.freeze(state.modules.slice()), root }
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
      message: `Circular module import: ${dependencyPath.join(' -> ')}.`,
    })
  }

  const cached = state.cache.get(input)
  if (cached) return cached
  const metadata = moduleMetadata(input)
  const compiled: CompiledModule = {
    exports: new Map(),
    imports: [],
    input,
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
    registerProviders(compiled, metadata.providers ?? [])

    ;(metadata.exports ?? []).forEach(token => {
      const record = isProviderToken(token)
        ? providerRecord(compiled, token)
        : undefined
      if (!record) {
        throw new InternalException(SYSTEM.INVALID_MODULE_EXPORT, {
          details: {
            module: compiled.name,
            token: providerName(token),
          },
          message: `Module "${compiled.name}" cannot export provider "${providerName(token)}".`,
        })
      }
      compiled.exports.set(token, record)
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
    message: `Module class "${module}" must use @Module or be replaced with an explicit module config.`,
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

    if (owner.providers.has(normalized.token)) {
      throw new InternalException(SYSTEM.DUPLICATE_PROVIDER, {
        details: {
          module: owner.name,
          token: providerTokenName(normalized.token),
        },
        message: `Provider "${providerTokenName(normalized.token)}" is registered more than once.`,
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
    const candidate = imported.exports.get(token)
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
      message: `Provider "${providerTokenName(token)}" is exported by more than one imported module.`,
    })
  })

  return matched
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
