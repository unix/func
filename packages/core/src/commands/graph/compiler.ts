import { SYSTEM } from '@func/contracts/core-errors'
import { createCommandInfo } from '../command-info'
import type { CommandInfo } from '../command-info'
import type { CommandParams, HandlerParams } from '../types'
import type { OptionParams } from '../../options/types'
import { InternalException } from '../../shared/errors'
import { handlers } from '../metadata'
import type {
  CommandEndpoint,
  CommandGraphParams,
  CommandNode,
  CompiledCommandGraph,
  FlagCommandEndpoint,
  FlagHandlerParams,
  MutableCommandNode,
  NamedEndpoint,
  SpecialCommandKind,
  SpecialEndpoint,
} from './model'
import { compileOptionPlan, throwDuplicateOption } from './option-plan'
import { validateRegistration } from './registration'
import type { HandlerRecord } from './registry'
import { CommandGraph } from './runtime'

export type {
  ActionEndpoint,
  CommandEndpoint,
  CommandGraphParams,
  CommandMatch,
  CommandNode,
  FlagCommandEndpoint,
  OptionCommandEndpoint,
  OptionPlan,
  ProviderOptionBinding,
} from './model'
export { CommandGraph } from './runtime'

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
      specialNodes.set(kind, nodes)
      specialRoots.set(kind, compiled)
    })
    const nodes: CommandNode[] = []
    const root = this.finalizeNode(this.root, new Map(), nodes)

    return {
      commandInfos: Object.freeze(this.registeredCommands.slice()),
      nodes,
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
        const endpoint = flagCommandEndpoint(
          namedCommandEndpoint(record, command, handler, command.path),
        )
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
        this.registerFlagEndpoint(
          root,
          flagCommandEndpoint(specialCommandEndpoint(record, handler, [])),
        )
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
      throwDuplicateOption(
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
      path: source.path.slice(),
      transitions,
    }
    cache.set(source, node)
    nodes.push(node)
    source.tokens.forEach((target, token) => {
      transitions.set(token, this.finalizeNode(target, cache, nodes))
    })

    return node
  }

  private nodeAt(
    root: MutableCommandNode,
    path: readonly string[],
  ): MutableCommandNode {
    return path.reduce((node, segment) => {
      const child = node.children.get(segment)
      if (child) return child
      throw new InternalException(SYSTEM.INTERNAL_INVARIANT, {
        details: { path },
      })
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
    })
  }
}

export const compileCommandGraph = (params: CommandGraphParams): CommandGraph => {
  const graph = new CommandGraphBuilder(params).build()
  const records = params.registry
    .commands()
    .concat(params.registry.majors(), params.registry.missing())
  return new CommandGraph(graph, records)
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
): NamedEndpoint<Handler> => {
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
): SpecialEndpoint<Handler> => ({
  handler,
  kind: 'command',
  path: path.slice(),
  record,
})

const flagCommandEndpoint = <Endpoint extends CommandEndpoint<FlagHandlerParams>>(
  endpoint: Endpoint,
): Endpoint & { option: OptionParams } => {
  const action = {
    ...endpoint,
    option: optionForFlagHandler(endpoint.handler),
  }
  return action
}

const isFlagHandler = (handler: HandlerParams): handler is FlagHandlerParams =>
  typeof handler.flag === 'string'

const optionForFlagHandler = (handler: FlagHandlerParams): OptionParams => ({
  aliases: handler.aliases,
  ...(handler.deprecated ? { deprecated: handler.deprecated } : {}),
  ...(handler.description ? { description: handler.description } : {}),
  name: handler.flag,
  type: Boolean,
})
