import { SYSTEM } from '@func/contracts/core-errors'
import type { ProviderRecord } from '../../di/module-graph'
import type { ExplicitProvider, Provider, ProviderToken, Type } from '../../di/types'
import { normalizeProvider, providerTokenName } from '../../di/provider-utils'
import { isBuiltInToken } from '../../runtime/injection'
import { InternalException } from '../../shared/errors'
import type { CompiledApplication } from '../../application/model'

export interface ModuleProviderOverride {
  module: Type
  provider: Provider
}

export type ProviderOverride = Provider | ModuleProviderOverride

export const applyProviderOverrides = (
  application: CompiledApplication,
  overrides: readonly ProviderOverride[],
) => {
  const replacements = new Map<ProviderRecord, ExplicitProvider>()

  overrides.forEach(override => {
    const { moduleOverride, provider } = resolvedOverride(override)
    const normalized = normalizeProvider(provider)
    if (isBuiltInToken(normalized.token)) {
      throw new InternalException(SYSTEM.INVALID_PROVIDER, {
        details: { token: providerTokenName(normalized.token) },
      })
    }

    const matches = providerMatches(
      application,
      normalized.token,
      moduleOverride?.module,
    )
    if (!matches.length) {
      throw new InternalException(SYSTEM.MISSING_PROVIDER, {
        details: { token: providerTokenName(normalized.token) },
      })
    }
    if (matches.length > 1) {
      throw new InternalException(SYSTEM.DUPLICATE_PROVIDER, {
        details: {
          modules: matches.map(record => record.owner.name),
          token: providerTokenName(normalized.token),
        },
      })
    }

    const record = matches[0]
    if (replacements.has(record)) {
      throw new InternalException(SYSTEM.DUPLICATE_PROVIDER, {
        details: {
          module: record.owner.name,
          token: providerTokenName(normalized.token),
        },
      })
    }

    replacements.set(record, normalized.definition)
  })

  replacements.forEach((definition, record) => {
    record.definition = definition
  })
}

const resolvedOverride = (
  override: ProviderOverride,
): { moduleOverride?: ModuleProviderOverride; provider: Provider } => {
  if (isModuleProviderOverride(override))
    return { moduleOverride: override, provider: override.provider }

  return { provider: override }
}

const isModuleProviderOverride = (
  override: ProviderOverride,
): override is ModuleProviderOverride =>
  typeof override === 'object' && 'module' in override && 'provider' in override

const providerMatches = (
  application: CompiledApplication,
  token: ProviderToken,
  moduleInput?: Type,
) => {
  if (moduleInput) {
    const module = application.graph.modules.find(item => item.input === moduleInput)
    const record = module?.providers.get(token)
    return record ? [record] : []
  }

  return application.graph.modules.flatMap(module => {
    const record = module.providers.get(token)
    return record ? [record] : []
  })
}
