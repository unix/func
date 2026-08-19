import { SYSTEM } from '@func/contracts/core-errors'
import { ArgTokenConflict, compileArgvPlan } from '../../argv'
import type { ArgvPlan } from '../../argv'
import { providerRecords } from '../../di/module-compiler'
import type { CompiledModule } from '../../di/module-compiler'
import type { OptionParams } from '../../options/types'
import type {
  CompiledModuleOption,
  CompiledOptionCommand,
  CompiledOptionProvider,
} from '../../options/compiler'
import { isOptionProvider, optionsForModule } from '../../options/compiler'
import type { CompiledFieldOption } from '../../options/field-metadata'
import { InternalException } from '../../shared/errors'
import { MODULE_OPTION } from '../../options/module-option'
import type {
  ActionEndpoint,
  CommandGraphParams,
  MutableCommandNode,
  OptionCommandEndpoint,
  OptionPlan,
  ProviderOptionBinding,
} from './model'
import type { HandlerRecord } from './registry'

interface FieldContributionBase {
  field: CompiledFieldOption
  option: OptionParams
  override: boolean
  owner: string
}

interface CommandFieldContribution extends FieldContributionBase {
  kind: 'command-field'
  record: HandlerRecord
}

interface ProviderFieldContribution extends FieldContributionBase {
  kind: 'provider-field'
  provider: CompiledOptionProvider
}

type FieldContribution = CommandFieldContribution | ProviderFieldContribution

interface ActionContribution {
  action: ActionEndpoint
  kind: 'action'
  option: OptionParams
  override: boolean
  owner: string
}

interface ProtocolContribution {
  kind: 'protocol'
  option: OptionParams
  override: false
  owner: string
}

type OptionContribution =
  ActionContribution | FieldContribution | ProtocolContribution

export const compileOptionPlan = (
  node: MutableCommandNode,
  params: CommandGraphParams,
): OptionPlan => {
  const records = executionRecords(node)
  const owner = optionOwner(node, records, params)
  const rootOptions = params.options.root
  const ownerOptions =
    owner === params.root ? [] : optionsForModule(params.options, owner)
  const moduleOptions = rootOptions.concat(ownerOptions)
  const table = new Map<string, OptionContribution>()
  applyScope(table, moduleContributions(rootOptions, node.path), 'root module')
  applyScope(table, protocolContributions(params.root), 'root module')
  applyScope(table, moduleContributions(ownerOptions, node.path), owner.name)
  if (owner !== params.root) {
    applyScope(table, protocolContributions(owner), owner.name)
  }
  const commandOptions = commandContributions(node, records)
  const compatibleFields = applyCommandScope(table, commandOptions)
  const contributions = Array.from(table.values())
  const argvPlan = compilePlan(contributions, node.path)
  const providerBindings = providerBindingsFrom(contributions)
  const commandBindings = commandBindingsFrom(contributions.concat(compatibleFields))
  const commandOptionNames = new Map(
    Array.from(commandBindings).map(([record, fields]) => [
      record,
      new Set(fields.map(field => field.name)),
    ]),
  )
  const actions = contributions.flatMap(contribution =>
    contribution.kind === 'action' ? [contribution.action] : [],
  )
  const commonOptions = contributions.flatMap(contribution =>
    contribution.kind === 'command-field' ? [] : [{ ...contribution.option }],
  )

  return {
    actions,
    argvPlan,
    commandBindings,
    commandOptionNames,
    commonOptionNames: new Set(commonOptions.map(option => option.name)),
    commonOptions,
    owner,
    providerBindings,
    providers: moduleOptions.slice(),
  }
}

const optionOwner = (
  node: MutableCommandNode,
  executable: readonly HandlerRecord[],
  params: CommandGraphParams,
): CompiledModule => {
  const owners = Array.from(
    new Set(
      (executable.length ? executable : Array.from(node.scopeRecords)).map(
        record => record.owner,
      ),
    ),
  )
  if (!owners.length) return params.root
  if (owners.length === 1) return owners[0]
  if (
    !owners.some(
      owner =>
        optionsForModule(params.options, owner).length ||
        providerRecords(owner, MODULE_OPTION).length,
    )
  )
    return params.root

  throw new InternalException(SYSTEM.AMBIGUOUS_OPTION_SCOPE, {
    details: { modules: owners.map(owner => owner.name), path: node.path },
  })
}

const protocolContributions = (module: CompiledModule): ProtocolContribution[] =>
  providerRecords(module, MODULE_OPTION).map(record => {
    const value = 'useValue' in record.definition ? record.definition.useValue : null
    if (!isOptionParams(value)) {
      throw new InternalException(SYSTEM.INVALID_OPTION_DECLARATION, {
        details: {
          module: record.owner.name,
          option: value,
          reason: 'invalid-module-option-contribution',
        },
      })
    }

    return {
      kind: 'protocol',
      option: value,
      override: false,
      owner: record.owner.name,
    }
  })

const moduleContributions = (
  options: readonly CompiledModuleOption[],
  path: readonly string[],
): OptionContribution[] => {
  const contributions: OptionContribution[] = []
  options.forEach(option => {
    if (isOptionProvider(option)) {
      option.fieldOptions.forEach(field => {
        contributions.push({
          field,
          kind: 'provider-field',
          option: field,
          override: field.override === true,
          owner: `${option.target.name}.${field.propertyKey}`,
          provider: option,
        })
      })
      return
    }

    contributions.push(optionCommandContribution(option, path))
  })
  return contributions
}

const optionCommandContribution = (
  declaration: CompiledOptionCommand,
  path: readonly string[],
): ActionContribution => ({
  action: {
    declaration,
    handler: declaration.handler,
    kind: 'option-command',
    option: declaration.option,
    owner: declaration.owner,
    path: path.slice(),
  } satisfies OptionCommandEndpoint,
  kind: 'action',
  option: declaration.option,
  override: declaration.option.overrideAll === true,
  owner: declaration.target.name || '(anonymous option command)',
})

const commandContributions = (
  node: MutableCommandNode,
  records: readonly HandlerRecord[],
): OptionContribution[] => {
  const contributions: OptionContribution[] = []
  records.forEach(record => {
    record.fieldOptions.forEach(field => {
      contributions.push({
        field,
        kind: 'command-field',
        option: field,
        override: field.override === true,
        owner: `${record.handler.name}.${field.propertyKey}`,
        record,
      })
    })
  })
  node.flagEndpoints.forEach(endpoint => {
    contributions.push({
      action: endpoint,
      kind: 'action',
      option: endpoint.option,
      override: false,
      owner: `${endpoint.record.handler.name}.${endpoint.handler.methodName}`,
    })
  })
  return contributions
}

const applyCommandScope = (
  table: Map<string, OptionContribution>,
  contributions: readonly OptionContribution[],
): FieldContribution[] => {
  const local = new Map<string, OptionContribution>()
  const compatibleFields: FieldContribution[] = []
  contributions.forEach(contribution => {
    const existing = local.get(contribution.option.name)
    if (!existing) {
      local.set(contribution.option.name, contribution)
      return
    }
    if (
      existing.kind === 'command-field' &&
      contribution.kind === 'command-field' &&
      existing.record !== contribution.record &&
      compatibleOptions(existing.option, contribution.option)
    ) {
      compatibleFields.push(contribution)
      return
    }

    throwDuplicateOption(
      `--${contribution.option.name}`,
      existing.owner,
      contribution.owner,
    )
  })
  applyScope(table, Array.from(local.values()), 'command')
  return compatibleFields.filter(field => {
    const winner = table.get(field.option.name)
    return winner?.kind === 'command-field'
  })
}

const applyScope = (
  table: Map<string, OptionContribution>,
  contributions: readonly OptionContribution[],
  scope: string,
) => {
  const local = new Map<string, OptionContribution>()
  contributions.forEach(contribution => {
    const existing = local.get(contribution.option.name)
    if (existing) {
      throwDuplicateOption(
        `--${contribution.option.name}`,
        existing.owner,
        contribution.owner,
      )
    }
    local.set(contribution.option.name, contribution)
  })

  local.forEach((contribution, name) => {
    const inherited = table.get(name)
    if (
      inherited?.kind === 'protocol' &&
      contribution.kind === 'protocol' &&
      compatibleOptions(inherited.option, contribution.option)
    ) {
      table.set(name, contribution)
      return
    }
    if (inherited && !contribution.override) {
      throw new InternalException(SYSTEM.OPTION_OVERRIDE_REQUIRED, {
        details: {
          current: contribution.owner,
          inherited: inherited.owner,
          option: name,
          scope,
        },
      })
    }
    table.set(name, contribution)
  })
}

const compilePlan = (
  contributions: readonly OptionContribution[],
  path: readonly string[],
): ArgvPlan => {
  try {
    return compileArgvPlan(
      contributions.map(contribution => ({
        option: contribution.option,
        owner: contribution.owner,
      })),
    )
  } catch (error) {
    if (error instanceof ArgTokenConflict) {
      throwDuplicateOption(error.token, error.firstOwner, error.secondOwner, path)
    }
    throw error
  }
}

const providerBindingsFrom = (
  contributions: Iterable<OptionContribution>,
): ProviderOptionBinding[] => {
  const bindings = new Map<CompiledOptionProvider, CompiledFieldOption[]>()
  for (const contribution of contributions) {
    if (contribution.kind !== 'provider-field') continue
    const fields = bindings.get(contribution.provider) ?? []
    fields.push(contribution.field)
    bindings.set(contribution.provider, fields)
  }
  return Array.from(bindings).map(([provider, fieldOptions]) => ({
    fieldOptions,
    provider,
  }))
}

const commandBindingsFrom = (
  contributions: Iterable<OptionContribution>,
): ReadonlyMap<HandlerRecord, readonly CompiledFieldOption[]> => {
  const bindings = new Map<HandlerRecord, CompiledFieldOption[]>()
  for (const contribution of contributions) {
    if (contribution.kind !== 'command-field') continue
    const fields = bindings.get(contribution.record) ?? []
    fields.push(contribution.field)
    bindings.set(contribution.record, fields)
  }
  return bindings
}

const executionRecords = (node: MutableCommandNode): HandlerRecord[] =>
  Array.from(
    new Set(
      [node.endpoint?.record]
        .concat(Array.from(node.flagEndpoints.values()).map(item => item.record))
        .filter((record): record is HandlerRecord => Boolean(record)),
    ),
  )

const compatibleOptions = (first: OptionParams, second: OptionParams): boolean =>
  first.name === second.name &&
  first.negatable === second.negatable &&
  sameAliases(first.aliases, second.aliases) &&
  compatibleOptionTypes(first.type, second.type)

const sameAliases = (first: readonly string[], second: readonly string[]): boolean =>
  first.length === second.length && first.every(alias => second.includes(alias))

const compatibleOptionTypes = (
  first: OptionParams['type'],
  second: OptionParams['type'],
): boolean => {
  if (first === second) return true
  if (!Array.isArray(first) || !Array.isArray(second)) return false
  return first[0] === second[0]
}

const isOptionParams = (value: unknown): value is OptionParams => {
  if (typeof value !== 'object' || value === null) return false
  const aliases: unknown = Reflect.get(value, 'aliases')
  const name: unknown = Reflect.get(value, 'name')
  const type: unknown = Reflect.get(value, 'type')
  return (
    Array.isArray(aliases) &&
    aliases.every((alias: unknown) => typeof alias === 'string') &&
    typeof name === 'string' &&
    isOptionType(type)
  )
}

const isOptionType = (value: unknown): value is OptionParams['type'] =>
  value === Boolean ||
  value === Number ||
  value === String ||
  (Array.isArray(value) &&
    value.length === 1 &&
    (value[0] === Number || value[0] === String))

export const throwDuplicateOption = (
  token: string,
  first: string,
  second: string,
  path: readonly string[] = [],
): never => {
  throw new InternalException(SYSTEM.DUPLICATE_OPTION_TOKEN, {
    details: {
      handlers: [first, second],
      path,
      scope: 'command',
      token,
      type: 'option',
    },
  })
}
