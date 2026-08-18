import type { Deprecation } from '../../deprecation'
import type {
  FieldOptionKind,
  OptionParams,
  UserOptionEnumValue,
} from '../../options/types'
import type { Args } from '../../runtime/args'
import { contextInvocation } from '../../runtime/context'
import type { Context } from '../../runtime/context'
import type { CommandNode, OptionPlan } from '../../commands/graph/model'
import type { CommandGraph } from '../../commands/graph/runtime'
import { handlers } from '../../commands/metadata'
import type {
  HelpCommandMeta,
  HelpMeta,
  HelpOptionKind,
  HelpOptionMeta,
  HelpUsageMeta,
  HelpValueType,
} from './interfaces'

interface HelpOptionSource extends OptionParams {
  dependsOn?: string[]
  enum?: UserOptionEnumValue[]
  exclusive?: string[]
  kind?: FieldOptionKind
  required?: boolean
}

export class HelpContext {
  constructor(
    readonly args: Args,
    readonly context: Context,
  ) {}

  get inputs(): readonly string[] {
    return this.args.inputs
  }

  createMeta(): HelpMeta {
    const { commandGraph, commandNode } = contextInvocation(this.context)
    const documentNode = this.documentNode(commandGraph, commandNode)
    const commands = this.commands(commandGraph, commandNode)
    const options = this.options(documentNode.optionPlan, documentNode)
    const description = this.description(commandGraph, documentNode)
    const deprecated = this.deprecation(commandGraph, documentNode)
    const path = Object.freeze(commandNode.path.slice())

    return Object.freeze({
      commands,
      ...(deprecated ? { deprecated } : {}),
      ...(description ? { description } : {}),
      options,
      path,
      title: path.join(' '),
      usage: this.usage(path, documentNode, commands, options),
    })
  }

  private commands(
    graph: CommandGraph,
    selectedNode: CommandNode,
  ): readonly HelpCommandMeta[] {
    const nodes = selectedNode.path.length ? [selectedNode] : this.rootNodes(graph)
    const commands = new Map<string, HelpCommandMeta>()

    nodes.forEach(node => {
      this.childCommands(graph, node).forEach(command => {
        const key = command.path.join('\0')
        if (!commands.has(key)) commands.set(key, command)
      })
    })

    return Object.freeze(Array.from(commands.values()))
  }

  private childCommands(graph: CommandGraph, node: CommandNode): HelpCommandMeta[] {
    const tokens = new Map<CommandNode, string[]>()
    node.transitions.forEach((child, token) => {
      const aliases = tokens.get(child) ?? []
      aliases.push(token)
      tokens.set(child, aliases)
    })

    return Array.from(tokens).map(([child, childTokens]) => {
      const name = child.path.at(-1) ?? childTokens[0]
      const description = this.description(graph, child)
      const deprecated = this.deprecation(graph, child)
      return Object.freeze({
        aliases: Object.freeze(childTokens.filter(token => token !== name)),
        ...(deprecated ? { deprecated } : {}),
        ...(description ? { description } : {}),
        name,
        path: Object.freeze(child.path.slice()),
      })
    })
  }

  private description(graph: CommandGraph, node: CommandNode): string | undefined {
    const endpointDescription =
      node.endpoint?.command?.description ?? node.endpoint?.handler.description
    if (endpointDescription) return endpointDescription

    const descriptions = new Set(
      graph.records().flatMap(record => {
        if (!record.command || !samePath(record.command.path, node.path)) return []
        return record.command.description ? [record.command.description] : []
      }),
    )
    if (descriptions.size === 1) return Array.from(descriptions)[0]
    return undefined
  }

  private deprecation(
    graph: CommandGraph,
    node: CommandNode,
  ): Deprecation | undefined {
    const endpointDeprecation = node.endpoint?.command?.deprecated
    if (endpointDeprecation) return endpointDeprecation

    const deprecations = new Set(
      graph.records().flatMap(record => {
        if (!record.command || !samePath(record.command.path, node.path)) return []
        return record.command.deprecated ? [record.command.deprecated] : []
      }),
    )
    if (deprecations.size === 1) return Array.from(deprecations)[0]
    return undefined
  }

  private documentNode(graph: CommandGraph, selectedNode: CommandNode): CommandNode {
    if (selectedNode.path.length) return selectedNode
    return this.majorRoot(graph) ?? selectedNode
  }

  private majorRoot(graph: CommandGraph): CommandNode | undefined {
    return graph.specialRoot(handlers.MAJOR)
  }

  private options(plan: OptionPlan, node: CommandNode): readonly HelpOptionMeta[] {
    const actions = new Map(plan.actions.map(action => [action.option.name, action]))
    const sources: HelpOptionSource[] = plan.commonOptions.slice()
    if (node.endpoint) {
      sources.push(...(plan.commandBindings.get(node.endpoint.record) ?? []))
    }
    const options = new Map<string, HelpOptionMeta>()

    sources.forEach(source => {
      if (options.has(source.name)) return
      const action = actions.get(source.name)
      options.set(source.name, this.option(source, Boolean(action)))
    })

    return Object.freeze(Array.from(options.values()))
  }

  private option(source: HelpOptionSource, action: boolean): HelpOptionMeta {
    const choices = source.enum ? Object.freeze(source.enum.slice()) : undefined
    const dependsOn = source.dependsOn
      ? Object.freeze(source.dependsOn.slice())
      : undefined
    const exclusive = source.exclusive
      ? Object.freeze(source.exclusive.slice())
      : undefined

    return Object.freeze({
      aliases: Object.freeze(source.aliases.slice()),
      ...(choices ? { choices } : {}),
      ...(source.deprecated ? { deprecated: source.deprecated } : {}),
      ...(dependsOn ? { dependsOn } : {}),
      ...(source.description ? { description: source.description } : {}),
      ...(exclusive ? { exclusive } : {}),
      kind: action ? 'action' : optionKind(source),
      name: source.name,
      negatable: !action && source.negatable === true,
      required: action ? false : source.required === true,
      type: optionType(source.type),
    })
  }

  private rootNodes(graph: CommandGraph): CommandNode[] {
    return [graph.rootNode(), this.majorRoot(graph)].filter(
      (node, index, nodes): node is CommandNode =>
        Boolean(node) && nodes.indexOf(node) === index,
    )
  }

  private usage(
    path: readonly string[],
    node: CommandNode,
    commands: readonly HelpCommandMeta[],
    options: readonly HelpOptionMeta[],
  ): readonly HelpUsageMeta[] {
    const usage: HelpUsageMeta[] = []
    if (node.endpoint || options.length || !commands.length) {
      usage.push(
        Object.freeze({
          command: false,
          inputs: Boolean(node.endpoint),
          options: Boolean(options.length),
          path,
        }),
      )
    }
    if (commands.length) {
      usage.push(
        Object.freeze({
          command: true,
          inputs: false,
          options: Boolean(options.length),
          path,
        }),
      )
    }

    return Object.freeze(usage)
  }
}

const optionKind = (source: HelpOptionSource): HelpOptionKind => {
  const kind: FieldOptionKind | undefined = source.kind
  if (kind) return kind
  return source.type === Boolean ? 'flag' : 'value'
}

const optionType = (type: OptionParams['type']): HelpValueType => {
  if (Array.isArray(type)) return type[0] === Number ? 'number[]' : 'string[]'
  if (type === Boolean) return 'boolean'
  if (type === Number) return 'number'
  return 'string'
}

const samePath = (first: readonly string[], second: readonly string[]): boolean =>
  first.length === second.length &&
  first.every((segment, index) => segment === second[index])
