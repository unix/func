import type { CompiledApplication } from '../../application/model'
import type { ArgToken, ArgvPlan } from '../../argv/interfaces'
import type {
  ActionEndpoint,
  CommandEndpoint,
  CommandNode,
  CompiledCommandGraph,
  OptionPlan,
  ProviderOptionBinding,
} from '../../commands/graph/model'
import type { HandlerRecord } from '../../commands/graph/registry'
import { CommandGraph } from '../../commands/graph/runtime'
import type {
  CompiledGraph,
  CompiledModule,
  ProviderRecord,
} from '../../di/module-graph'
import type {
  CompiledModuleOption,
  CompiledOptionCommand,
  CompiledOptionProvider,
} from '../../options/compiler'
import type { CompiledFieldOption } from '../../options/field-metadata'
import type { HandlerParams } from '../../commands/types'
import type {
  PrecompiledActionPlan,
  PrecompiledApplicationPlan,
  PrecompiledCommandEndpointPlan,
  PrecompiledModuleOptionPlan,
  PrecompiledOptionPlan,
} from './plan'
import { PRECOMPILED_APPLICATION_ABI } from './plan'

interface HydratedCommandNode {
  endpoint?: CommandEndpoint
  readonly optionPlan: OptionPlan
  readonly path: readonly string[]
  readonly transitions: Map<string, CommandNode>
}

export const hydrateApplicationPlan = (
  input: unknown,
  appName?: string,
): CompiledApplication => {
  const plan = assertPlan(input)
  const modules = hydrateModules(plan)
  const providers = hydrateProviders(plan, modules)
  connectModules(plan, modules, providers)
  const handlers = hydrateHandlers(plan, modules)
  const options = hydrateModuleOptions(plan.options, modules, providers)
  const nodes = hydrateNodes(plan.nodes.length, index => {
    const source = plan.nodes[index]
    return {
      optionPlan: hydrateOptionPlan(source.optionPlan, handlers, options, modules),
      path: source.path,
      transitions: new Map(),
    }
  })
  plan.nodes.forEach((source, index) => {
    const node = nodes[index]
    source.transitions.forEach(([token, target]) => {
      node.transitions.set(token, required(nodes, target, 'command node'))
    })
    if (source.endpoint) {
      node.endpoint = hydrateEndpoint(source.endpoint, handlers)
    }
  })
  const commandGraph = new CommandGraph(hydrateCommandGraph(plan, nodes), handlers)
  const graph: CompiledGraph = {
    modules,
    root: required(modules, plan.rootModule, 'root module'),
  }

  return {
    ...(appName === undefined ? {} : { appName }),
    commandGraph,
    graph,
  }
}

const assertPlan = (plan: unknown): PrecompiledApplicationPlan => {
  if (isApplicationPlan(plan)) return plan
  throw new TypeError(
    `Unsupported func precompiled application ABI: ${String(planAbi(plan))}.`,
  )
}

const isApplicationPlan = (value: unknown): value is PrecompiledApplicationPlan =>
  Boolean(
    value &&
    typeof value === 'object' &&
    'abi' in value &&
    value.abi === PRECOMPILED_APPLICATION_ABI,
  )

const planAbi = (value: unknown): unknown =>
  value && typeof value === 'object' ? Reflect.get(value, 'abi') : undefined

const hydrateModules = (plan: PrecompiledApplicationPlan): CompiledModule[] =>
  plan.modules.map(module => ({
    exports: new Map(),
    imports: [],
    input: module.input,
    multiProviders: new Map(),
    name: module.name,
    options: [],
    providers: new Map(),
  }))

const hydrateProviders = (
  plan: PrecompiledApplicationPlan,
  modules: readonly CompiledModule[],
): ProviderRecord[] =>
  plan.providers.map(provider => ({
    definition: provider.definition,
    kind: provider.kind,
    owner: required(modules, provider.owner, 'provider owner'),
    token: provider.token,
  }))

const connectModules = (
  plan: PrecompiledApplicationPlan,
  modules: readonly CompiledModule[],
  providers: readonly ProviderRecord[],
) => {
  plan.modules.forEach((source, index) => {
    const module = modules[index]
    module.imports = source.imports.map(target =>
      required(modules, target, 'module import'),
    )
    source.providers.forEach(target => {
      const record = required(providers, target, 'module provider')
      module.providers.set(record.token, record)
    })
    source.multiProviders.forEach(group => {
      module.multiProviders.set(
        group.token,
        group.records.map(target =>
          required(providers, target, 'module multi-provider'),
        ),
      )
    })
    module.options = source.options.map(target =>
      required(providers, target, 'module option'),
    )
    source.exports.forEach(entry => {
      const records = entry.records.map(target =>
        required(providers, target, 'module export'),
      )
      module.exports.set(
        entry.token,
        entry.multiple ? records : required(records, 0, 'module export'),
      )
    })
  })
}

const hydrateHandlers = (
  plan: PrecompiledApplicationPlan,
  modules: readonly CompiledModule[],
): HandlerRecord[] =>
  plan.handlers.map(handler => ({
    ...(handler.command ? { command: handler.command } : {}),
    fieldOptions: handler.fieldOptions.slice(),
    handler: handler.handler,
    ...(handler.kind ? { kind: handler.kind } : {}),
    methodHandlers: handler.methodHandlers.slice(),
    owner: required(modules, handler.owner, 'handler owner'),
  }))

const hydrateModuleOptions = (
  plans: readonly PrecompiledModuleOptionPlan[],
  modules: readonly CompiledModule[],
  providers: readonly ProviderRecord[],
): CompiledModuleOption[] =>
  plans.map(option => {
    const base = {
      owner: required(modules, option.owner, 'option owner'),
      record: required(providers, option.record, 'option provider'),
      target: option.target,
    }
    if (option.kind === 'action') {
      return {
        ...base,
        handler: option.handler,
        kind: option.kind,
        option: option.option,
      } satisfies CompiledOptionCommand
    }
    return {
      ...base,
      fieldOptions: option.fieldOptions.slice(),
      kind: option.kind,
    } satisfies CompiledOptionProvider
  })

const hydrateNodes = (
  length: number,
  hydrate: (index: number) => HydratedCommandNode,
): HydratedCommandNode[] => Array.from({ length }, (_, index) => hydrate(index))

const hydrateOptionPlan = (
  plan: PrecompiledOptionPlan,
  handlers: readonly HandlerRecord[],
  options: readonly CompiledModuleOption[],
  modules: readonly CompiledModule[],
): OptionPlan => ({
  actions: plan.actions.map(action => hydrateAction(action, handlers, options)),
  argvPlan: hydrateArgvPlan(plan.argvPlan),
  commandBindings: new Map(
    plan.commandBindings.map(binding => {
      const target = required(handlers, binding.target, 'command binding')
      return [target, fields(target.fieldOptions, binding.fields)]
    }),
  ),
  commandOptionNames: new Map(
    plan.commandOptionNames.map(binding => [
      required(handlers, binding.target, 'command option names'),
      new Set(binding.names),
    ]),
  ),
  commonOptionNames: new Set(plan.commonOptionNames),
  commonOptions: plan.commonOptions,
  owner: required(modules, plan.owner, 'option plan owner'),
  providerBindings: plan.providerBindings.map(binding => {
    const provider = required(options, binding.target, 'provider binding')
    if (provider.kind !== 'value') {
      throw new TypeError('Invalid func precompiled provider binding.')
    }
    return {
      fieldOptions: fields(provider.fieldOptions, binding.fields),
      provider,
    } satisfies ProviderOptionBinding
  }),
  providers: plan.providers.map(target =>
    required(options, target, 'option plan provider'),
  ),
})

const hydrateArgvPlan = (plan: PrecompiledOptionPlan['argvPlan']): ArgvPlan => {
  const options = plan.options.slice()
  const tokens = new Map<string, ArgToken>()
  plan.tokens.forEach(token => {
    tokens.set(token.token, {
      ...(token.booleanValue === undefined
        ? {}
        : { booleanValue: token.booleanValue }),
      option: required(options, token.option, 'argv option'),
    })
  })
  return { options, tokens }
}

const hydrateAction = (
  action: PrecompiledActionPlan,
  handlers: readonly HandlerRecord[],
  options: readonly CompiledModuleOption[],
): ActionEndpoint => {
  if (action.kind === 'option-command') {
    const declaration = required(options, action.declaration, 'option action')
    if (declaration.kind !== 'action') {
      throw new TypeError('Invalid func precompiled option action.')
    }
    return {
      declaration,
      handler: declaration.handler,
      kind: action.kind,
      option: declaration.option,
      owner: declaration.owner,
      path: action.path,
    }
  }
  const record = required(handlers, action.handler, 'flag action')
  const handler = required(
    record.methodHandlers,
    action.method,
    'flag action handler',
  )
  if (!isFlagHandler(handler))
    throw new TypeError('Invalid func precompiled flag action.')
  return {
    handler,
    kind: action.kind,
    option: action.option,
    path: action.path,
    record,
  }
}

const isFlagHandler = (
  handler: HandlerParams,
): handler is HandlerParams & { flag: string } => typeof handler.flag === 'string'

const hydrateEndpoint = (
  endpoint: PrecompiledCommandEndpointPlan,
  handlers: readonly HandlerRecord[],
): CommandEndpoint => {
  const record = required(handlers, endpoint.handler, 'command endpoint')
  const base = {
    handler: required(record.methodHandlers, endpoint.method, 'endpoint handler'),
    kind: 'command' as const,
    path: endpoint.path,
    record,
  }
  if (!endpoint.command) return base
  return { ...base, command: endpoint.command }
}

const hydrateCommandGraph = (
  plan: PrecompiledApplicationPlan,
  nodes: readonly CommandNode[],
): CompiledCommandGraph => ({
  commandInfos: plan.commands,
  nodes,
  root: required(nodes, plan.rootNode, 'root command node'),
  specialNodes: new Map(
    plan.specialNodes.map(entry => [
      entry.kind,
      entry.nodes.map(target => required(nodes, target, 'special command node')),
    ]),
  ),
  specialRoots: new Map(
    plan.specialRoots.map(entry => [
      entry.kind,
      required(nodes, entry.node, 'special command root'),
    ]),
  ),
})

const fields = (
  source: readonly CompiledFieldOption[],
  indices: readonly number[],
): CompiledFieldOption[] =>
  indices.map(index => required(source, index, 'field option'))

const required = <Value>(
  values: readonly Value[],
  index: number,
  kind: string,
): Value => {
  const value = values[index]
  if (value !== undefined) return value
  throw new TypeError(`Invalid func precompiled ${kind} index: ${index}.`)
}
