import { RUNTIME, SYSTEM } from '@func/contracts/core-errors'
import { parseArgv } from '../argv'
import type { ArgParseFailure, ParsedArgv } from '../argv'
import { handlers } from '../commands/metadata'
import type {
  ActionEndpoint,
  CommandEndpoint,
  CommandMatch,
  CommandNode,
  OptionPlan,
} from '../commands/graph/model'
import type { CommandGraph } from '../commands/graph/runtime'
import type { HandlerRecord } from '../commands/graph/registry'
import type { OptionParams } from '../options/types'
import { ErrorScope, InternalException } from '../shared/errors'

interface InvocationCandidate {
  match: CommandMatch
  parsed: ParsedArgv
  plan: OptionPlan
}

export interface ResolvedInvocation extends InvocationCandidate {
  action?: ActionEndpoint
  effectiveOptions: readonly OptionParams[]
  endpoint?: CommandEndpoint
}

class InvocationResolver {
  constructor(
    private readonly commandGraph: CommandGraph,
    private readonly argv: readonly string[],
  ) {}

  resolve(): ResolvedInvocation {
    const errors: ArgParseFailure[] = []
    const normal = this.candidates(
      this.commandGraph.namedNodes(),
      args => this.commandGraph.match(args),
      errors,
    )
    const rootNode = this.commandGraph.rootNode()
    const rootParsed = this.tryParse(rootNode.optionPlan, errors)
    const rootCandidate = rootParsed
      ? {
          match: {
            consumed: 0,
            invokedPath: [],
            node: rootNode,
          },
          parsed: rootParsed,
          plan: rootNode.optionPlan,
        }
      : undefined
    if (normal.length && rootCandidate && !rootCandidate.parsed.positionals.length) {
      this.uniqueCandidate(normal.concat([rootCandidate]))
    }
    const named = this.uniqueCandidate(normal, true)
    if (named) return this.selectTarget(named)
    if (
      rootCandidate &&
      !rootCandidate.parsed.positionals.length &&
      this.matchedActions(rootCandidate).length
    ) {
      return this.selectTarget(rootCandidate)
    }

    const major = this.candidates(
      this.commandGraph
        .specialNodes(handlers.MAJOR)
        .filter(node => node.path.length),
      args => this.commandGraph.matchSpecial(handlers.MAJOR, args),
      errors,
    )
    const matchedMajor = this.uniqueCandidate(major, true)
    if (matchedMajor) return this.selectTarget(matchedMajor)

    const missing = this.candidates(
      this.commandGraph.specialNodes(handlers.MISSING),
      args => this.commandGraph.matchSpecial(handlers.MISSING, args),
      errors,
    ).filter(candidate => candidate.parsed.positionals.length)
    const matchedMissing = this.uniqueCandidate(missing, true)
    if (matchedMissing) return this.selectTarget(matchedMissing)

    const majorRoot = this.candidates(
      this.commandGraph
        .specialNodes(handlers.MAJOR)
        .filter(node => !node.path.length),
      args => this.commandGraph.matchSpecial(handlers.MAJOR, args),
      errors,
    ).filter(candidate => !candidate.parsed.positionals.length)
    const defaultMajor = this.uniqueCandidate(majorRoot)
    if (defaultMajor) return this.selectTarget(defaultMajor)
    if (
      rootCandidate &&
      !rootCandidate.parsed.positionals.length &&
      !rootCandidate.parsed.unknown.length
    ) {
      return {
        ...rootCandidate,
        effectiveOptions: rootCandidate.plan.commonOptions,
      }
    }
    if (errors.length) return throwParseFailure(errors[0])
    return this.throwUnknownInvocation(
      rootParsed?.positionals ?? [],
      rootParsed?.unknown ?? this.argv,
    )
  }

  private candidates(
    nodes: readonly CommandNode[],
    match: (args: readonly string[]) => CommandMatch | undefined,
    errors: ArgParseFailure[],
  ): InvocationCandidate[] {
    return nodes.flatMap(node => {
      const parsed = this.tryParse(node.optionPlan, errors)
      if (!parsed) return []
      const matched = match(parsed.positionals)
      if (matched?.node !== node) return []
      return [{ match: matched, parsed, plan: node.optionPlan }]
    })
  }

  private tryParse(
    plan: OptionPlan,
    errors: ArgParseFailure[],
  ): ParsedArgv | undefined {
    const result = parseArgv(plan.argvPlan, this.argv)
    if (result.success) return result.parsed
    errors.push(result.failure)
    return undefined
  }

  private uniqueCandidate(
    candidates: readonly InvocationCandidate[],
    preferLongest = false,
  ): InvocationCandidate | undefined {
    if (candidates.length <= 1) return candidates[0]
    if (preferLongest) {
      const consumed = Math.max(
        ...candidates.map(candidate => candidate.match.consumed),
      )
      const longest = candidates.filter(
        candidate => candidate.match.consumed === consumed,
      )
      if (longest.length === 1) return longest[0]
    }
    throw new InternalException(RUNTIME.AMBIGUOUS_INVOCATION, {
      details: {
        input: this.argv,
        paths: candidates.map(candidate => candidate.match.node.path),
      },
      message: `Invocation matches multiple command scopes: ${candidates
        .map(candidate => candidate.match.node.path.join(' ') || '(root)')
        .join(', ')}.`,
      scope: ErrorScope.RUNTIME,
    })
  }

  private selectTarget(candidate: InvocationCandidate): ResolvedInvocation {
    const actions = this.matchedActions(candidate)
    if (actions.length > 1) {
      throw new InternalException(RUNTIME.MULTIPLE_OPTIONS, {
        details: { options: actions.map(action => action.option.name) },
        message: `Only one action option can be invoked at a time: ${actions
          .map(action => `--${action.option.name}`)
          .join(', ')}.`,
        scope: ErrorScope.RUNTIME,
      })
    }

    const action = actions.at(0)
    const endpoint = action ? undefined : candidate.match.node.endpoint
    const commandRecord =
      action?.kind === 'command' ? action.record : endpoint?.record
    const targetOptions = candidate.plan.commonOptions.concat(
      commandRecord ? (candidate.plan.commandBindings.get(commandRecord) ?? []) : [],
    )
    this.throwUnknownOptions(candidate, commandRecord)
    const applicationRoot = this.commandGraph.rootNode()
    if (!action && !endpoint && candidate.match.node !== applicationRoot) {
      throw new InternalException(SYSTEM.NO_MATCHING_HANDLER, {
        details: { path: candidate.match.node.path },
      })
    }

    return {
      ...candidate,
      ...(action ? { action } : {}),
      effectiveOptions: targetOptions,
      ...(endpoint ? { endpoint } : {}),
    }
  }

  private matchedActions(candidate: InvocationCandidate): ActionEndpoint[] {
    return candidate.plan.actions.filter(action =>
      candidate.parsed.supplied.has(action.option.name),
    )
  }

  private throwUnknownOptions(
    candidate: InvocationCandidate,
    commandRecord: HandlerRecord | undefined,
  ) {
    const commandNames = commandRecord
      ? candidate.plan.commandOptionNames.get(commandRecord)
      : undefined
    const disallowed = Array.from(candidate.parsed.supplied).flatMap(name =>
      candidate.plan.commonOptionNames.has(name) || commandNames?.has(name)
        ? []
        : [`--${name}`],
    )
    const options = disallowed.concat(candidate.parsed.unknown)
    if (!options.length) return

    throw new InternalException(RUNTIME.UNKNOWN_OPTION, {
      details: { options },
      message: `Unknown option${options.length > 1 ? 's' : ''}: ${options.join(', ')}.`,
      scope: ErrorScope.RUNTIME,
    })
  }

  private throwUnknownInvocation(
    positionals: readonly string[],
    unknown: readonly string[],
  ): never {
    const first = positionals[0]
    if (first) {
      throw new InternalException(RUNTIME.UNKNOWN_COMMAND, {
        details: { command: first, input: this.argv },
        message: `Unknown command "${first}".`,
        scope: ErrorScope.RUNTIME,
      })
    }

    throw new InternalException(RUNTIME.UNKNOWN_OPTION, {
      details: { options: unknown },
      message: `Unknown option${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}.`,
      scope: ErrorScope.RUNTIME,
    })
  }
}

export const resolveInvocation = (
  commandGraph: CommandGraph,
  argv: readonly string[],
): ResolvedInvocation => new InvocationResolver(commandGraph, argv).resolve()

const throwParseFailure = (failure: ArgParseFailure): never => {
  throw new InternalException(RUNTIME.PARSE, {
    details: failure.details,
    message: failure.message,
    scope: ErrorScope.RUNTIME,
  })
}
