import type { ArgToken } from '../../arg/interfaces'
import { compileApplication } from '../../application/module-compiler'
import type {
  ActionEndpoint,
  CommandGraph,
  CommandNode,
  OptionPlan,
} from '../../containers/command-graph'
import type { Type } from '../../di/provider'
import type {
  Deprecation,
  OptionParams,
  UserOptionEnumValue,
} from '../../interfaces'
import { handlers } from '../../utils/metadata'
import type {
  CompletionItem,
  CompletionRequest,
  CompletionResult,
} from './interfaces'
import { parseCompletionArgs } from './parser'
import type { ParsedCompletionArgs } from './parser'

interface CompletionContext {
  readonly consumed: number
  readonly graph: CommandGraph
  readonly node: CommandNode
  readonly parsed: ParsedCompletionArgs
  readonly unmatched: number
}

interface CompletionOption extends OptionParams {
  readonly enum?: readonly UserOptionEnumValue[]
  readonly exclusive?: readonly string[]
}

interface ValueTarget {
  readonly option: CompletionOption
  readonly prefix: string
  readonly valuePrefix: string
}

export const complete = (
  input: Type,
  request: CompletionRequest,
): CompletionResult => {
  validateRequest(request)
  const graph = compileApplication(input).commandGraph
  return completeGraph(graph, request)
}

export const completeGraph = (
  graph: CommandGraph,
  request: CompletionRequest,
): CompletionResult => {
  const contexts = selectContexts(graph, request.args)
  const valueTargets = contexts.flatMap(context =>
    valueTarget(context, request.incomplete),
  )
  if (valueTargets.length) return valueResult(valueTargets)

  const items = contexts.flatMap(context => [
    ...commandItems(context, request.incomplete),
    ...optionItems(context, request.incomplete),
  ])
  return result(dedupe(items), request.incomplete.startsWith('-') ? 'none' : 'file')
}

const selectContexts = (
  graph: CommandGraph,
  argv: readonly string[],
): CompletionContext[] => {
  const normal = contextsFrom(graph, graph.nodes(), graph.rootNode(), argv)
  const majorRoot = graph.specialRoot(handlers.MAJOR)
  const major = majorRoot
    ? contextsFrom(graph, graph.specialNodes(handlers.MAJOR), majorRoot, argv)
    : []
  const missingRoot = graph.specialRoot(handlers.MISSING)
  const missing = missingRoot
    ? contextsFrom(
        graph,
        graph.specialNodes(handlers.MISSING),
        missingRoot,
        argv,
      ).filter(context => context.parsed.positionals.length)
    : []
  const consumed = Math.max(0, ...normal.map(context => context.consumed))
  if (consumed) return normal.filter(context => context.consumed === consumed)
  const majorConsumed = Math.max(0, ...major.map(context => context.consumed))
  if (majorConsumed)
    return major.filter(context => context.consumed === majorConsumed)
  if (missing.length) {
    const missingConsumed = Math.max(0, ...missing.map(context => context.consumed))
    return missing.filter(context => context.consumed === missingConsumed)
  }

  return normal
    .concat(major)
    .filter(
      context =>
        context.node.path.length === 0 && !context.parsed.positionals.length,
    )
}

const contextsFrom = (
  graph: CommandGraph,
  nodes: readonly CommandNode[],
  root: CommandNode,
  argv: readonly string[],
): CompletionContext[] =>
  nodes.flatMap(node => {
    const parsed = parseCompletionArgs(node.optionPlan.argPlan, argv)
    const match = matchFrom(root, parsed.positionals)
    if (match.node !== node) return []
    return [
      {
        consumed: match.consumed,
        graph,
        node,
        parsed,
        unmatched: parsed.positionals.length - match.consumed,
      },
    ]
  })

const matchFrom = (
  root: CommandNode,
  argv: readonly string[],
): { consumed: number; node: CommandNode } => {
  let consumed = 0
  let node = root
  while (consumed < argv.length) {
    const token = argv[consumed]
    if (!token || token.startsWith('-')) break
    const child = node.transitions.get(token)
    if (!child) break
    node = child
    consumed += 1
  }
  return { consumed, node }
}

const valueTarget = (
  context: CompletionContext,
  incomplete: string,
): ValueTarget[] => {
  if (context.parsed.expected) {
    const option = optionForToken(context, context.parsed.expected)
    return option ? [{ option, prefix: '', valuePrefix: incomplete }] : []
  }
  if (!incomplete.startsWith('--')) return []
  const equals = incomplete.indexOf('=')
  if (equals < 0) return []
  const token = context.node.optionPlan.argPlan.tokens.get(
    incomplete.slice(0, equals),
  )
  if (!token || token.option.type === 'boolean') return []
  const option = optionForToken(context, token)
  return option
    ? [
        {
          option,
          prefix: incomplete.slice(0, equals + 1),
          valuePrefix: incomplete.slice(equals + 1),
        },
      ]
    : []
}

const optionForToken = (
  context: CompletionContext,
  token: ArgToken,
): CompletionOption | undefined =>
  effectiveOptions(context).find(option => option.name === token.option.name)

const valueResult = (targets: readonly ValueTarget[]): CompletionResult => {
  const items = targets.flatMap(target =>
    (target.option.enum ?? []).flatMap(value => {
      const candidate = String(value)
      if (!candidate.startsWith(target.valuePrefix)) return []
      return [
        item(`${target.prefix}${candidate}`, 'value', target.option.description),
      ]
    }),
  )
  return result(dedupe(items), 'none')
}

const commandItems = (
  context: CompletionContext,
  incomplete: string,
): CompletionItem[] => {
  if (context.parsed.endOfOptions || context.unmatched || incomplete.startsWith('-'))
    return []

  const children = new Set(context.node.transitions.values())
  return Array.from(children).flatMap(child => {
    const canonical = child.path[child.path.length - 1]
    if (!canonical) return []
    const tokens = Array.from(context.node.transitions)
      .filter(([, target]) => target === child)
      .map(([token]) => token)
    const candidates = incomplete
      ? tokens.filter(token => token.startsWith(incomplete))
      : [canonical]
    const description = commandDescription(context.graph, child)
    return candidates.map(value => item(value, 'command', description))
  })
}

const commandDescription = (
  graph: CommandGraph,
  node: CommandNode,
): string | undefined => {
  if (node.endpoint?.command?.description)
    return withDeprecation(
      node.endpoint.command.description,
      node.endpoint.command.deprecated,
    )
  const record = graph
    .records()
    .find(candidate =>
      candidate.command?.path.every(
        (segment, index) => node.path[index] === segment,
      ),
    )
  return record?.command
    ? withDeprecation(record.command.description, record.command.deprecated)
    : undefined
}

const optionItems = (
  context: CompletionContext,
  incomplete: string,
): CompletionItem[] => {
  if (context.parsed.endOfOptions || (incomplete && !incomplete.startsWith('-')))
    return []
  const options = effectiveOptions(context)
  return options.flatMap(option => {
    if (hiddenOption(option, context, options)) return []
    const tokens = optionTokens(option, incomplete)
    const description = withDeprecation(option.description, option.deprecated)
    return tokens.map(value => item(value, 'option', description))
  })
}

const effectiveOptions = (context: CompletionContext): CompletionOption[] => {
  const { optionPlan } = context.node
  const options: CompletionOption[] = optionPlan.commonOptions.slice()
  const action = selectedAction(optionPlan, context.parsed.supplied)
  const record = action?.kind === 'command' ? action.record : undefined
  if (record) options.push(...(optionPlan.commandBindings.get(record) ?? []))
  if (action?.kind === 'option-command') return dedupeOptions(options)
  if (!action && context.node.endpoint)
    options.push(
      ...(optionPlan.commandBindings.get(context.node.endpoint.record) ?? []),
    )
  if (!action && !context.node.endpoint)
    optionPlan.commandBindings.forEach(fields => options.push(...fields))
  return dedupeOptions(options)
}

const selectedAction = (
  plan: OptionPlan,
  supplied: ReadonlySet<string>,
): ActionEndpoint | undefined => {
  const actions = plan.actions.filter(action => supplied.has(action.option.name))
  if (actions.length !== 1) return undefined
  return actions[0]
}

const hiddenOption = (
  option: CompletionOption,
  context: CompletionContext,
  options: readonly CompletionOption[],
): boolean => {
  const { supplied } = context.parsed
  if (supplied.has(option.name) && !Array.isArray(option.type)) return true
  const actionNames = new Set(
    context.node.optionPlan.actions.map(action => action.option.name),
  )
  if (
    actionNames.has(option.name) &&
    Array.from(actionNames).some(name => name !== option.name && supplied.has(name))
  )
    return true
  if (option.exclusive?.some(name => supplied.has(name))) return true
  return options.some(
    candidate =>
      supplied.has(candidate.name) && candidate.exclusive?.includes(option.name),
  )
}

const optionTokens = (option: CompletionOption, incomplete: string): string[] => {
  const canonical = `--${option.name}`
  if (!incomplete) return [canonical]
  const tokens = [canonical]
  if (option.negatable) tokens.push(`--no-${option.name}`)
  if (!incomplete.startsWith('--'))
    tokens.push(...option.aliases.map(alias => `-${alias}`))
  return tokens.filter(token => token.startsWith(incomplete))
}

const dedupeOptions = (options: readonly CompletionOption[]): CompletionOption[] => {
  const names = new Set<string>()
  return options.filter(option => {
    if (names.has(option.name)) return false
    names.add(option.name)
    return true
  })
}

const item = (
  value: string,
  kind: CompletionItem['kind'],
  description?: string,
): CompletionItem =>
  Object.freeze({
    ...(description ? { description } : {}),
    kind,
    value,
  })

const dedupe = (items: readonly CompletionItem[]): CompletionItem[] => {
  const values = new Set<string>()
  return items.filter(candidate => {
    if (values.has(candidate.value)) return false
    values.add(candidate.value)
    return true
  })
}

const result = (
  items: readonly CompletionItem[],
  fallback: CompletionResult['fallback'],
): CompletionResult =>
  Object.freeze({
    appendSpace: true,
    fallback,
    items: Object.freeze(items.slice()),
  })

const withDeprecation = (
  description: string | undefined,
  deprecated: Deprecation | undefined,
): string | undefined => {
  if (!deprecated) return description
  const notice = deprecated === true ? 'deprecated' : `deprecated: ${deprecated}`
  return description ? `${description} (${notice})` : notice
}

const validateRequest = (request: CompletionRequest) => {
  if (!Array.isArray(request.args))
    throw new TypeError('Completion request args must be an array of strings.')
  if (request.args.some(value => typeof value !== 'string'))
    throw new TypeError('Completion request args must be an array of strings.')
  if (typeof request.incomplete !== 'string')
    throw new TypeError('Completion request incomplete must be a string.')
}
