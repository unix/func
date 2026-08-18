import { SYSTEM } from '@func/contracts/core-errors'
import type { ModuleInput } from '../application/definition'
import { InternalException } from '../shared/errors'
import type { ExplicitProvider, ProviderToken } from './types'
import { providerTokenName } from './provider-utils'

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

export const isProviderRecordList = (
  value: ProviderRecord | readonly ProviderRecord[] | undefined,
): value is readonly ProviderRecord[] => Array.isArray(value)
