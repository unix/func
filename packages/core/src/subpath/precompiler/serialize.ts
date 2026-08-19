import type { CompiledApplication } from '../../application/model'
import { handlers } from '../../commands/metadata'
import type {
  ActionEndpoint,
  CommandEndpoint,
  CommandNode,
  OptionPlan,
} from '../../commands/graph/model'
import type { HandlerRecord } from '../../commands/graph/registry'
import type { CompiledModule, ProviderRecord } from '../../di/module-graph'
import type { CompiledModuleOption } from '../../options/compiler'
import type { CompiledFieldOption } from '../../options/field-metadata'
import type {
  PrecompiledActionPlan,
  PrecompiledApplicationPlan,
  PrecompiledCommandEndpointPlan,
  PrecompiledCommandNodePlan,
  PrecompiledModuleOptionPlan,
  PrecompiledOptionPlan,
} from '../precompiled/plan'
import { PRECOMPILED_APPLICATION_ABI } from '../precompiled/plan'
import type { SpecialCommandKind } from '../../commands/graph/model'

interface PlanIndices {
  readonly handlers: ReadonlyMap<HandlerRecord, number>
  readonly modules: ReadonlyMap<CompiledModule, number>
  readonly nodes: ReadonlyMap<CommandNode, number>
  readonly options: ReadonlyMap<CompiledModuleOption, number>
}

const SPECIAL_KINDS: readonly SpecialCommandKind[] = [
  handlers.MAJOR,
  handlers.MISSING,
]

export const applicationPlan = (
  application: CompiledApplication,
): PrecompiledApplicationPlan => {
  const modules = application.graph.modules
  const moduleIndices = indices(modules)
  const providers = modules.flatMap(module => [
    ...module.providers.values(),
    ...Array.from(module.multiProviders.values()).flat(),
  ])
  const uniqueProviders = unique(providers)
  const providerIndices = indices(uniqueProviders)
  const handlerRecords = application.commandGraph.records()
  const handlerIndices = indices(handlerRecords)
  const commandNodes = unique([
    ...application.commandGraph.nodes(),
    ...application.commandGraph.specialNodes(handlers.MAJOR),
    ...application.commandGraph.specialNodes(handlers.MISSING),
  ])
  const nodeIndices = indices(commandNodes)
  const moduleOptions = collectModuleOptions(commandNodes)
  const optionIndices = indices(moduleOptions)
  const planIndices: PlanIndices = {
    handlers: handlerIndices,
    modules: moduleIndices,
    nodes: nodeIndices,
    options: optionIndices,
  }

  return {
    abi: PRECOMPILED_APPLICATION_ABI,
    commands: application.commandGraph.commands(),
    handlers: handlerRecords.map(record => ({
      ...(record.command ? { command: record.command } : {}),
      fieldOptions: record.fieldOptions,
      handler: record.handler,
      ...(record.kind ? { kind: record.kind } : {}),
      methodHandlers: record.methodHandlers,
      owner: requiredIndex(moduleIndices, record.owner, 'handler owner'),
    })),
    modules: modules.map(module => ({
      exports: Array.from(module.exports, ([token, value]) => ({
        multiple: Array.isArray(value),
        records: (Array.isArray(value) ? value : [value]).map(record =>
          requiredIndex(providerIndices, record, 'module export'),
        ),
        token,
      })),
      imports: module.imports.map(target =>
        requiredIndex(moduleIndices, target, 'module import'),
      ),
      input: module.input,
      multiProviders: Array.from(module.multiProviders, ([token, records]) => ({
        records: records.map(record =>
          requiredIndex(providerIndices, record, 'multi-provider'),
        ),
        token,
      })),
      name: module.name,
      options: module.options.map(record =>
        requiredIndex(providerIndices, record, 'module option'),
      ),
      providers: Array.from(module.providers.values(), record =>
        requiredIndex(providerIndices, record, 'module provider'),
      ),
    })),
    nodes: commandNodes.map(node => commandNodePlan(node, planIndices)),
    options: moduleOptions.map(option =>
      moduleOptionPlan(option, moduleIndices, providerIndices),
    ),
    providers: uniqueProviders.map(provider => ({
      definition: provider.definition,
      kind: provider.kind,
      owner: requiredIndex(moduleIndices, provider.owner, 'provider owner'),
      token: provider.token,
    })),
    rootModule: requiredIndex(moduleIndices, application.graph.root, 'root module'),
    rootNode: requiredIndex(
      nodeIndices,
      application.commandGraph.rootNode(),
      'root command node',
    ),
    specialNodes: SPECIAL_KINDS.flatMap(kind => {
      const nodes = application.commandGraph.specialNodes(kind)
      if (!nodes.length) return []
      return [
        {
          kind,
          nodes: nodes.map(node =>
            requiredIndex(nodeIndices, node, 'special command node'),
          ),
        },
      ]
    }),
    specialRoots: SPECIAL_KINDS.flatMap(kind => {
      const node = application.commandGraph.specialRoot(kind)
      if (!node) return []
      return [
        {
          kind,
          node: requiredIndex(nodeIndices, node, 'special command root'),
        },
      ]
    }),
  }
}

const collectModuleOptions = (
  nodes: readonly CommandNode[],
): CompiledModuleOption[] =>
  unique(
    nodes.flatMap(node => [
      ...node.optionPlan.providers,
      ...node.optionPlan.providerBindings.map(binding => binding.provider),
      ...node.optionPlan.actions.flatMap(action =>
        action.kind === 'option-command' ? [action.declaration] : [],
      ),
    ]),
  )

const commandNodePlan = (
  node: CommandNode,
  lookup: PlanIndices,
): PrecompiledCommandNodePlan => ({
  ...(node.endpoint
    ? { endpoint: commandEndpointPlan(node.endpoint, lookup.handlers) }
    : {}),
  optionPlan: optionPlan(node.optionPlan, lookup),
  path: node.path,
  transitions: Array.from(node.transitions, ([token, target]) => [
    token,
    requiredIndex(lookup.nodes, target, 'command transition'),
  ]),
})

const commandEndpointPlan = (
  endpoint: CommandEndpoint,
  handlerIndices: ReadonlyMap<HandlerRecord, number>,
): PrecompiledCommandEndpointPlan => ({
  ...('command' in endpoint && endpoint.command
    ? { command: endpoint.command }
    : {}),
  handler: requiredIndex(handlerIndices, endpoint.record, 'command endpoint'),
  method: requiredIndex(
    indices(endpoint.record.methodHandlers),
    endpoint.handler,
    'command handler',
  ),
  path: endpoint.path,
})

const moduleOptionPlan = (
  option: CompiledModuleOption,
  modules: ReadonlyMap<CompiledModule, number>,
  providers: ReadonlyMap<ProviderRecord, number>,
): PrecompiledModuleOptionPlan => {
  const base = {
    owner: requiredIndex(modules, option.owner, 'module option owner'),
    record: requiredIndex(providers, option.record, 'module option provider'),
    target: option.target,
  }
  if (option.kind === 'action') {
    return {
      ...base,
      handler: option.handler,
      kind: option.kind,
      option: option.option,
    }
  }
  return { ...base, fieldOptions: option.fieldOptions, kind: option.kind }
}

const optionPlan = (
  plan: OptionPlan,
  lookup: PlanIndices,
): PrecompiledOptionPlan => {
  const argvOptionIndices = indices(plan.argvPlan.options)
  return {
    actions: plan.actions.map(action => actionPlan(action, lookup)),
    argvPlan: {
      options: plan.argvPlan.options,
      tokens: Array.from(plan.argvPlan.tokens, ([token, value]) => ({
        ...(value.booleanValue === undefined
          ? {}
          : { booleanValue: value.booleanValue }),
        option: requiredIndex(argvOptionIndices, value.option, 'argv option'),
        token,
      })),
    },
    commandBindings: Array.from(plan.commandBindings, ([record, fields]) => ({
      fields: fieldIndices(record.fieldOptions, fields),
      target: requiredIndex(lookup.handlers, record, 'command binding'),
    })),
    commandOptionNames: Array.from(plan.commandOptionNames, ([record, names]) => ({
      names: Array.from(names),
      target: requiredIndex(lookup.handlers, record, 'command option names'),
    })),
    commonOptionNames: Array.from(plan.commonOptionNames),
    commonOptions: plan.commonOptions,
    owner: requiredIndex(lookup.modules, plan.owner, 'option plan owner'),
    providerBindings: plan.providerBindings.map(binding => ({
      fields: fieldIndices(binding.provider.fieldOptions, binding.fieldOptions),
      target: requiredIndex(lookup.options, binding.provider, 'provider binding'),
    })),
    providers: plan.providers.map(option =>
      requiredIndex(lookup.options, option, 'option plan provider'),
    ),
  }
}

const actionPlan = (
  action: ActionEndpoint,
  lookup: PlanIndices,
): PrecompiledActionPlan => {
  if (action.kind === 'option-command') {
    return {
      declaration: requiredIndex(
        lookup.options,
        action.declaration,
        'option action',
      ),
      kind: action.kind,
      path: action.path,
    }
  }
  return {
    handler: requiredIndex(lookup.handlers, action.record, 'flag action'),
    kind: action.kind,
    method: requiredIndex(
      indices(action.record.methodHandlers),
      action.handler,
      'flag action handler',
    ),
    option: action.option,
    path: action.path,
  }
}

const fieldIndices = (
  source: readonly CompiledFieldOption[],
  selected: readonly CompiledFieldOption[],
): number[] => {
  const sourceIndices = indices(source)
  return selected.map(field => requiredIndex(sourceIndices, field, 'field option'))
}

const indices = <Value>(values: readonly Value[]): Map<Value, number> =>
  new Map(values.map((value, index) => [value, index]))

const requiredIndex = <Value>(
  values: ReadonlyMap<Value, number>,
  value: Value,
  kind: string,
): number => {
  const index = values.get(value)
  if (index !== undefined) return index
  throw new TypeError(`Unable to serialize func precompiled ${kind}.`)
}

const unique = <Value>(values: readonly Value[]): Value[] =>
  Array.from(new Set(values))
