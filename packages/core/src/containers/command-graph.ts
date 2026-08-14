import { SYSTEM } from '@func/shared/core-errors'
import { createCommandInfo } from '../context'
import type { CommandInfo } from '../context'
import type { CompiledModule } from '../di/compiler'
import type { CommandParams, HandlerParams, OptionParams } from '../interfaces'
import type {
  CompiledModuleOption,
  CompiledModuleOptions,
  CompiledOptionCommand,
  CompiledOptionProvider,
} from '../options/compiler'
import { isOptionProvider, optionsForModule } from '../options/compiler'
import type { CompiledFieldOption } from '../options/field-metadata'
import { InternalException } from '../shared/errors'
import { handlers } from '../utils/metadata'
import type { HandlerRegistry } from './handler-registry'
import type { HandlerRecord } from './handler-registry'

interface CommandEndpointBase<Handler extends HandlerParams = HandlerParams> {
  handler: Handler
  kind: 'command'
  path: readonly string[]
  record: HandlerRecord
}

interface NamedCommandEndpoint<
  Handler extends HandlerParams = HandlerParams,
> extends CommandEndpointBase<Handler> {
  command: CommandInfo
}

interface SpecialCommandEndpoint<
  Handler extends HandlerParams = HandlerParams,
> extends CommandEndpointBase<Handler> {
  command?: never
}

export type CommandEndpoint<Handler extends HandlerParams = HandlerParams> =
  NamedCommandEndpoint<Handler> | SpecialCommandEndpoint<Handler>

type FlagHandlerParams = HandlerParams & { flag: string }
export type FlagCommandEndpoint = CommandEndpoint<FlagHandlerParams>

export interface OptionCommandEndpoint {
  declaration: CompiledOptionCommand
  handler: HandlerParams
  kind: 'option-command'
  option: OptionParams
  owner: CompiledModule
  path: readonly string[]
}

export type ActionEndpoint = FlagCommandEndpoint | OptionCommandEndpoint

export interface ProviderOptionBinding {
  fieldOptions: readonly CompiledFieldOption[]
  provider: CompiledOptionProvider
}

export interface OptionPlan {
  readonly actions: readonly ActionEndpoint[]
  readonly commandBindings: ReadonlyMap<
    HandlerRecord,
    readonly CompiledFieldOption[]
  >
  readonly commonOptions: readonly OptionParams[]
  readonly options: readonly OptionParams[]
  readonly owner: CompiledModule
  readonly providerBindings: readonly ProviderOptionBinding[]
  readonly providers: readonly CompiledModuleOption[]
}

export interface CommandNode {
  readonly endpoint?: CommandEndpoint
  readonly optionPlan: OptionPlan
  readonly path: readonly string[]
  readonly transitions: ReadonlyMap<string, CommandNode>
}

export interface CommandMatch {
  consumed: number
  invokedPath: readonly string[]
  node: CommandNode
}

interface MutableCommandNode {
  children: Map<string, MutableCommandNode>
  endpoint?: CommandEndpoint
  flagEndpoints: Map<string, FlagCommandEndpoint>
  path: string[]
  scopeRecords: Set<HandlerRecord>
  tokenOwners: Map<string, string>
  tokens: Map<string, MutableCommandNode>
}

interface CompiledCommandGraph {
  commandInfos: readonly CommandInfo[]
  nodes: readonly CommandNode[]
  root: CommandNode
  specialNodes: ReadonlyMap<SpecialCommandKind, readonly CommandNode[]>
  specialRoots: ReadonlyMap<SpecialCommandKind, CommandNode>
}

export interface CommandGraphParams {
  options: CompiledModuleOptions
  registry: HandlerRegistry
  root: CompiledModule
}

type SpecialCommandKind = handlers.MAJOR | handlers.MISSING

interface FieldContribution {
  field: CompiledFieldOption
  kind: 'command-field' | 'provider-field'
  option: OptionParams
  override: boolean
  owner: string
  provider?: CompiledOptionProvider
  record?: HandlerRecord
}

interface ActionContribution {
  action: ActionEndpoint
  kind: 'action'
  option: OptionParams
  override: boolean
  owner: string
}

type OptionContribution = ActionContribution | FieldContribution

class CommandGraphBuilder {
  private readonly registeredCommands: CommandInfo[] = []
  private readonly root = buildCommandNode([])
  private readonly specialRoots = new Map<SpecialCommandKind, MutableCommandNode>()

  constructor(private readonly params: CommandGraphParams) {
    validateRegistration(params.registry)
    params.registry.commands().forEach(record => this.registerCommand(record))
    const major = params.registry.majors().at(0)
    const missing = params.registry.missing().at(0)
    if (major) this.registerSpecial(handlers.MAJOR, major)
    if (missing) this.registerSpecial(handlers.MISSING, missing)
  }

  build(): CompiledCommandGraph {
    const specialNodes = new Map<SpecialCommandKind, readonly CommandNode[]>()
    const specialRoots = new Map<SpecialCommandKind, CommandNode>()
    this.specialRoots.forEach((root, kind) => {
      const nodes: CommandNode[] = []
      const compiled = this.finalizeNode(root, new Map(), nodes)
      specialNodes.set(kind, Object.freeze(nodes))
      specialRoots.set(kind, compiled)
    })
    const nodes: CommandNode[] = []
    const root = this.finalizeNode(this.root, new Map(), nodes)

    return {
      commandInfos: Object.freeze(this.registeredCommands.slice()),
      nodes: Object.freeze(nodes),
      root,
      specialNodes,
      specialRoots,
    }
  }

  private registerCommand(record: HandlerRecord) {
    const command = record.command
    if (!command) return
    const prefix = this.ensurePath(this.root, command.path, record)
    command.aliases.forEach(alias =>
      this.registerAlias(this.root, prefix, alias, record),
    )

    record.methodHandlers.forEach(handler => {
      if (isFlagHandler(handler)) {
        const endpoint = namedCommandEndpoint(record, command, handler, command.path)
        this.registerFlagEndpoint(prefix, endpoint)
        this.registeredCommands.push(endpoint.command)
        return
      }

      const path = command.path.concat(handler.path)
      const node = this.ensurePath(this.root, path, record)
      const endpoint = namedCommandEndpoint(record, command, handler, path)
      this.registerPathEndpoint(node, endpoint)
      this.registeredCommands.push(endpoint.command)
    })
  }

  private registerSpecial(kind: SpecialCommandKind, record: HandlerRecord) {
    const root = buildCommandNode([])
    root.scopeRecords.add(record)
    this.specialRoots.set(kind, root)
    record.methodHandlers.forEach(handler => {
      if (isFlagHandler(handler)) {
        this.registerFlagEndpoint(root, specialCommandEndpoint(record, handler, []))
        return
      }

      const node = this.ensurePath(root, handler.path, record)
      this.registerPathEndpoint(
        node,
        specialCommandEndpoint(record, handler, handler.path),
      )
    })
  }

  private ensurePath(
    root: MutableCommandNode,
    path: readonly string[],
    record: HandlerRecord,
  ): MutableCommandNode {
    return path.reduce((parent, segment) => {
      const tokenNode = parent.tokens.get(segment)
      const canonicalNode = parent.children.get(segment)
      if (tokenNode && tokenNode !== canonicalNode) {
        this.throwDuplicateCommandToken(
          segment,
          parent.tokenOwners.get(segment) ?? '(unknown command)',
          record.handler.name,
        )
      }
      const child = canonicalNode ?? buildCommandNode(parent.path.concat([segment]))
      if (!canonicalNode) {
        parent.children.set(segment, child)
        parent.tokens.set(segment, child)
        parent.tokenOwners.set(segment, record.handler.name)
      }
      child.scopeRecords.add(record)
      return child
    }, root)
  }

  private registerAlias(
    root: MutableCommandNode,
    node: MutableCommandNode,
    alias: string,
    record: HandlerRecord,
  ) {
    const parent = this.nodeAt(root, node.path.slice(0, -1))
    const existing = parent.tokens.get(alias)
    if (existing && existing !== node) {
      this.throwDuplicateCommandToken(
        alias,
        parent.tokenOwners.get(alias) ?? '(unknown command)',
        record.handler.name,
      )
    }

    parent.tokens.set(alias, node)
    parent.tokenOwners.set(alias, record.handler.name)
  }

  private registerPathEndpoint(node: MutableCommandNode, endpoint: CommandEndpoint) {
    if (node.endpoint) {
      this.throwDuplicateCommandToken(
        endpoint.path.join(' '),
        node.endpoint.record.handler.name,
        endpoint.record.handler.name,
      )
    }

    node.endpoint = endpoint
  }

  private registerFlagEndpoint(
    node: MutableCommandNode,
    endpoint: FlagCommandEndpoint,
  ) {
    const existing = node.flagEndpoints.get(endpoint.handler.flag)
    if (existing) {
      this.throwDuplicateOptionToken(
        `--${endpoint.handler.flag}`,
        existing.record.handler.name,
        endpoint.record.handler.name,
      )
    }
    node.flagEndpoints.set(endpoint.handler.flag, endpoint)
  }

  private finalizeNode(
    source: MutableCommandNode,
    cache: Map<MutableCommandNode, CommandNode>,
    nodes: CommandNode[],
  ): CommandNode {
    const cached = cache.get(source)
    if (cached) return cached
    const transitions = new Map<string, CommandNode>()
    const node: CommandNode = {
      endpoint: source.endpoint,
      optionPlan: compileOptionPlan(source, this.params),
      path: Object.freeze(source.path.slice()),
      transitions,
    }
    cache.set(source, node)
    nodes.push(node)
    source.tokens.forEach((target, token) => {
      transitions.set(token, this.finalizeNode(target, cache, nodes))
    })

    return Object.freeze(node)
  }

  private nodeAt(
    root: MutableCommandNode,
    path: readonly string[],
  ): MutableCommandNode {
    return path.reduce((node, segment) => {
      const child = node.children.get(segment)
      if (child) return child
      throw new TypeError(`Command node "${path.join(' ')}" is not registered.`)
    }, root)
  }

  private throwDuplicateCommandToken(
    token: string,
    first: string,
    second: string,
  ): never {
    throw new InternalException(SYSTEM.DUPLICATE_COMMAND_TOKEN, {
      details: {
        handlers: [first, second],
        scope: 'command',
        token,
        type: 'command path',
      },
      message: `Duplicate command path "${token}" found in "${first}" and "${second}".`,
    })
  }

  private throwDuplicateOptionToken(
    token: string,
    first: string,
    second: string,
  ): never {
    return throwDuplicateOption(token, first, second)
  }
}

export class CommandGraph {
  private readonly commandInfos: readonly CommandInfo[]
  private readonly commandNodes: readonly CommandNode[]
  private readonly handlerRecords: readonly HandlerRecord[]
  private readonly root: CommandNode
  private readonly specialCommandNodes: ReadonlyMap<
    SpecialCommandKind,
    readonly CommandNode[]
  >
  private readonly specialRoots: ReadonlyMap<SpecialCommandKind, CommandNode>

  constructor(params: CommandGraphParams) {
    const graph = new CommandGraphBuilder(params).build()
    this.commandInfos = graph.commandInfos
    this.commandNodes = graph.nodes
    this.handlerRecords = Object.freeze(
      params.registry
        .commands()
        .concat(params.registry.majors(), params.registry.missing()),
    )
    this.root = graph.root
    this.specialCommandNodes = graph.specialNodes
    this.specialRoots = graph.specialRoots
  }

  commands(): readonly CommandInfo[] {
    return this.commandInfos
  }

  nodes(): readonly CommandNode[] {
    return this.commandNodes
  }

  records(): readonly HandlerRecord[] {
    return this.handlerRecords
  }

  specialNodes(kind: SpecialCommandKind): readonly CommandNode[] {
    return this.specialCommandNodes.get(kind) ?? []
  }

  match(argv: readonly string[]): CommandMatch | undefined {
    return this.matchFrom(this.root, argv, false)
  }

  matchSpecial(
    kind: SpecialCommandKind,
    argv: readonly string[],
  ): CommandMatch | undefined {
    const root = this.specialRoots.get(kind)
    if (!root) return undefined
    return this.matchFrom(root, argv, true)
  }

  private matchFrom(
    root: CommandNode,
    argv: readonly string[],
    allowRoot: boolean,
  ): CommandMatch | undefined {
    let node = root
    let consumed = 0

    while (consumed < argv.length) {
      const token = argv[consumed]
      if (!token || token.startsWith('-')) break
      const child = node.transitions.get(token)
      if (!child) break
      node = child
      consumed += 1
    }

    if (!allowRoot && !consumed) return undefined
    return {
      consumed,
      invokedPath: Object.freeze(argv.slice(0, consumed)),
      node,
    }
  }
}

const compileOptionPlan = (
  node: MutableCommandNode,
  params: CommandGraphParams,
): OptionPlan => {
  const owner = optionOwner(node, params)
  const moduleOptions = scopedModuleOptions(params.options, owner, params.root)
  const table = new Map<string, OptionContribution>()
  const rootOptions = moduleOptions.filter(option => option.owner === params.root)
  const ownerOptions = moduleOptions.filter(option => option.owner !== params.root)
  applyScope(table, moduleContributions(rootOptions, node.path), 'root module')
  applyScope(table, moduleContributions(ownerOptions, node.path), owner.name)
  const records = executionRecords(node)
  const commandOptions = commandContributions(node, records)
  const compatibleFields = applyCommandScope(table, commandOptions)
  validateTokens(table.values(), node.path)
  const providerBindings = providerBindingsFrom(table.values())
  const commandBindings = commandBindingsFrom(
    Array.from(table.values()).concat(compatibleFields),
  )
  const actions = Array.from(table.values()).flatMap(contribution =>
    contribution.kind === 'action' ? [contribution.action] : [],
  )

  return Object.freeze({
    actions: Object.freeze(actions),
    commandBindings,
    commonOptions: Object.freeze(
      Array.from(table.values()).flatMap(contribution =>
        contribution.kind === 'command-field'
          ? []
          : [Object.freeze({ ...contribution.option })],
      ),
    ),
    options: Object.freeze(
      Array.from(table.values()).map(contribution =>
        Object.freeze({ ...contribution.option }),
      ),
    ),
    owner,
    providerBindings: Object.freeze(providerBindings),
    providers: Object.freeze(moduleOptions.slice()),
  })
}

const optionOwner = (
  node: MutableCommandNode,
  params: CommandGraphParams,
): CompiledModule => {
  const executable = executionRecords(node)
  const owners = Array.from(
    new Set(
      (executable.length ? executable : Array.from(node.scopeRecords)).map(
        record => record.owner,
      ),
    ),
  )
  if (!owners.length) return params.root
  if (owners.length === 1) return owners[0]
  if (!owners.some(owner => optionsForModule(params.options, owner).length))
    return params.root

  throw new InternalException(SYSTEM.AMBIGUOUS_OPTION_SCOPE, {
    details: { modules: owners.map(owner => owner.name), path: node.path },
    message: `Command node "${node.path.join(' ')}" belongs to multiple module option scopes.`,
  })
}

const scopedModuleOptions = (
  compiled: CompiledModuleOptions,
  owner: CompiledModule,
  root: CompiledModule,
): CompiledModuleOption[] => {
  const options = compiled.root.slice()
  if (owner !== root) options.push(...optionsForModule(compiled, owner))
  return options
}

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
    path: Object.freeze(path.slice()),
  },
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
    const option = optionForFlagHandler(endpoint.handler)
    contributions.push({
      action: endpoint,
      kind: 'action',
      option,
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
    if (inherited && !contribution.override) {
      throw new InternalException(SYSTEM.OPTION_OVERRIDE_REQUIRED, {
        details: {
          current: contribution.owner,
          inherited: inherited.owner,
          option: name,
          scope,
        },
        message: `Option "--${name}" in "${contribution.owner}" must explicitly override "${inherited.owner}".`,
      })
    }
    table.set(name, contribution)
  })
}

const validateTokens = (
  contributions: Iterable<OptionContribution>,
  path: readonly string[],
) => {
  const tokens = new Map<string, string>()
  Array.from(contributions).forEach(contribution => {
    registerToken(tokens, `--${contribution.option.name}`, contribution.owner, path)
    if (contribution.option.negatable === true) {
      registerToken(
        tokens,
        `--no-${contribution.option.name}`,
        contribution.owner,
        path,
      )
    }
    contribution.option.aliases.forEach(alias =>
      registerToken(tokens, `-${alias}`, contribution.owner, path),
    )
  })
}

const registerToken = (
  tokens: Map<string, string>,
  token: string,
  owner: string,
  path: readonly string[],
) => {
  const existing = tokens.get(token)
  if (existing) throwDuplicateOption(token, existing, owner, path)
  tokens.set(token, owner)
}

const providerBindingsFrom = (
  contributions: Iterable<OptionContribution>,
): ProviderOptionBinding[] => {
  const bindings = new Map<CompiledOptionProvider, CompiledFieldOption[]>()
  Array.from(contributions).forEach(contribution => {
    if (contribution.kind !== 'provider-field' || !contribution.provider) return
    const fields = bindings.get(contribution.provider) ?? []
    fields.push(contribution.field)
    bindings.set(contribution.provider, fields)
  })
  return Array.from(bindings).map(([provider, fieldOptions]) =>
    Object.freeze({ fieldOptions: Object.freeze(fieldOptions), provider }),
  )
}

const commandBindingsFrom = (
  contributions: Iterable<OptionContribution>,
): ReadonlyMap<HandlerRecord, readonly CompiledFieldOption[]> => {
  const bindings = new Map<HandlerRecord, CompiledFieldOption[]>()
  Array.from(contributions).forEach(contribution => {
    if (contribution.kind !== 'command-field' || !contribution.record) return
    const fields = bindings.get(contribution.record) ?? []
    fields.push(contribution.field)
    bindings.set(contribution.record, fields)
  })
  return new Map(
    Array.from(bindings).map(([record, fields]) => [record, Object.freeze(fields)]),
  )
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

const throwDuplicateOption = (
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
    message: `Duplicate option token "${token}" found in "${first}" and "${second}".`,
  })
}

const buildCommandNode = (path: string[]): MutableCommandNode => ({
  children: new Map(),
  flagEndpoints: new Map(),
  path,
  scopeRecords: new Set(),
  tokenOwners: new Map(),
  tokens: new Map(),
})

const namedCommandEndpoint = <Handler extends HandlerParams>(
  record: HandlerRecord,
  commandParams: CommandParams,
  handler: Handler,
  path: string[],
): NamedCommandEndpoint<Handler> => {
  const command = createCommandInfo({
    aliases: commandParams.aliases,
    ...(commandParams.deprecated ? { deprecated: commandParams.deprecated } : {}),
    ...(handler.description
      ? { description: handler.description }
      : !handler.path.length && commandParams.description
        ? { description: commandParams.description }
        : {}),
    fieldOptions: record.fieldOptions,
    path,
  })

  return {
    command,
    handler,
    kind: 'command',
    path: command.path,
    record,
  }
}

const specialCommandEndpoint = <Handler extends HandlerParams>(
  record: HandlerRecord,
  handler: Handler,
  path: string[],
): SpecialCommandEndpoint<Handler> => ({
  handler,
  kind: 'command',
  path: Object.freeze(path.slice()),
  record,
})

const isFlagHandler = (handler: HandlerParams): handler is FlagHandlerParams =>
  typeof handler.flag === 'string'

export const optionForAction = (action: ActionEndpoint): OptionParams => {
  if (action.kind === 'option-command') return action.option
  return optionForFlagHandler(action.handler)
}

const optionForFlagHandler = (handler: FlagHandlerParams): OptionParams => ({
  aliases: handler.aliases,
  ...(handler.deprecated ? { deprecated: handler.deprecated } : {}),
  ...(handler.description ? { description: handler.description } : {}),
  name: handler.flag,
  type: Boolean,
})

const validateRegistration = (registry: HandlerRegistry) => {
  validateKnownHandlers(registry)
  validateSpecialCount(registry.majors(), SYSTEM.MULTIPLE_MAJOR_COMMANDS, 'major')
  validateSpecialCount(
    registry.missing(),
    SYSTEM.MULTIPLE_MISSING_COMMANDS,
    'missing',
  )
  registry
    .commands()
    .concat(registry.majors())
    .concat(registry.missing())
    .forEach(validateCommandShape)
}

const validateKnownHandlers = (registry: HandlerRegistry) => {
  if (!registry.invalidHandlers.length) return
  const names = registry.invalidHandlers.map(
    record => record.handler.name || '<anonymous>',
  )
  throw new InternalException(SYSTEM.UNKNOWN_HANDLER, {
    details: { handlers: names },
    message: `All handlers passed to Container must use a func decorator: ${names.join(', ')}.`,
  })
}

const validateSpecialCount = (
  records: HandlerRecord[],
  code: SYSTEM.MULTIPLE_MAJOR_COMMANDS | SYSTEM.MULTIPLE_MISSING_COMMANDS,
  kind: 'major' | 'missing',
) => {
  if (records.length <= 1) return
  const names = records.map(record => record.handler.name)
  throw new InternalException(code, {
    details: { handlers: names, scope: 'command' },
    message: `Only one ${kind} command can be registered: ${names.join(', ')}.`,
  })
}

const validateCommandShape = (record: HandlerRecord) => {
  const methodHandlers = record.methodHandlers
  if (!methodHandlers.length) {
    throw new InternalException(SYSTEM.MISSING_HANDLER, {
      details: { handler: record.handler.name },
      message: `Command "${record.handler.name}" must define at least one @Handler method.`,
    })
  }

  const defaults = methodHandlers.filter(
    handler => !handler.flag && !handler.path.length,
  )
  if (record.kind === handlers.COMMAND || defaults.length <= 1) return
  throw new InternalException(SYSTEM.MULTIPLE_DEFAULT_HANDLERS, {
    details: {
      handler: record.handler.name,
      methods: defaults.map(handler => handler.methodName),
    },
    message: `Command "${record.handler.name}" must define only one default @Handler method.`,
  })
}
