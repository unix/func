import arg from 'arg'
import { RUNTIME_PRINT, SYSTEM } from '@func/shared/core-errors'
import * as filter from '../utils/filter'
import { handlers } from '../utils/metadata'
import { ErrorScope, InternalException } from '../shared/errors'
import type { OptionParams } from '../interfaces'
import type {
  ActionEndpoint,
  CommandEndpoint,
  CommandGraph,
  CommandMatch,
  CommandNode,
  OptionPlan,
} from './command-graph'
import { optionForAction } from './command-graph'

interface InvocationCandidate {
  args: arg.Result<any>
  match: CommandMatch
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
    const errors: Error[] = []
    const normal = this.candidates(
      this.commandGraph.nodes().filter(node => node.path.length),
      args => this.commandGraph.match(args),
      errors,
    )
    const rootNode = this.commandGraph.nodes().find(node => !node.path.length)
    if (!rootNode) throw new TypeError('Command graph root is missing.')
    const rootArgs = this.tryParse(rootNode.optionPlan, errors)
    const rootCandidate = rootArgs
      ? {
          args: rootArgs,
          match: {
            consumed: 0,
            invokedPath: Object.freeze([]),
            node: rootNode,
          },
          plan: rootNode.optionPlan,
        }
      : undefined
    if (normal.length && rootCandidate && !rootCandidate.args._.length) {
      this.uniqueCandidate(normal.concat([rootCandidate]))
    }
    const named = this.uniqueCandidate(normal, true)
    if (named) return this.selectTarget(named)
    if (
      rootCandidate &&
      !rootCandidate.args._.length &&
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
    ).filter(candidate => {
      const first = candidate.args._[0]
      return first && !first.startsWith('-')
    })
    const matchedMissing = this.uniqueCandidate(missing, true)
    if (matchedMissing) return this.selectTarget(matchedMissing)

    const majorRoot = this.candidates(
      this.commandGraph
        .specialNodes(handlers.MAJOR)
        .filter(node => !node.path.length),
      args => this.commandGraph.matchSpecial(handlers.MAJOR, args),
      errors,
    ).filter(candidate => !candidate.args._.length)
    const defaultMajor = this.uniqueCandidate(majorRoot)
    if (defaultMajor) return this.selectTarget(defaultMajor)
    if (rootCandidate && !rootCandidate.args._.length) {
      return {
        ...rootCandidate,
        effectiveOptions: rootCandidate.plan.commonOptions,
      }
    }
    if (errors.length) throw errors[0]
    return this.throwUnknownInvocation(rootArgs?._ ?? this.argv)
  }

  private candidates(
    nodes: readonly CommandNode[],
    match: (args: readonly string[]) => CommandMatch | undefined,
    errors: Error[],
  ): InvocationCandidate[] {
    return nodes.flatMap(node => {
      const args = this.tryParse(node.optionPlan, errors)
      if (!args) return []
      const matched = match(args._)
      if (matched?.node !== node) return []
      return [{ args, match: matched, plan: node.optionPlan }]
    })
  }

  private tryParse(plan: OptionPlan, errors: Error[]): arg.Result<any> | undefined {
    try {
      const argv = filter.normalizeNumberArrayArguments(plan.options, this.argv)
      const args = parse(filter.optionsToKeyValue(plan.options), argv)
      filter.normalizeNegatableOptions(plan.options, args)
      validateNumberOptions(plan.options, args)
      return args
    } catch (error) {
      errors.push(normalizeError(error))
      return undefined
    }
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
    throw new InternalException(RUNTIME_PRINT.AMBIGUOUS_INVOCATION, {
      details: {
        input: this.argv,
        paths: candidates.map(candidate => candidate.match.node.path),
      },
      message: `Invocation matches multiple command scopes: ${candidates
        .map(candidate => candidate.match.node.path.join(' ') || '(root)')
        .join(', ')}.`,
      scope: ErrorScope.RUNTIME_PRINT,
    })
  }

  private selectTarget(candidate: InvocationCandidate): ResolvedInvocation {
    const actions = this.matchedActions(candidate)
    if (actions.length > 1) {
      throw new InternalException(RUNTIME_PRINT.MULTIPLE_OPTIONS, {
        details: { options: actions.map(action => optionForAction(action).name) },
        message: `Only one action option can be invoked at a time: ${actions
          .map(action => `--${optionForAction(action).name}`)
          .join(', ')}.`,
        scope: ErrorScope.RUNTIME_PRINT,
      })
    }

    const action = actions.at(0)
    const endpoint = action ? undefined : candidate.match.node.endpoint
    const commandRecord =
      action?.kind === 'command' ? action.record : endpoint?.record
    const targetOptions = candidate.plan.commonOptions.concat(
      commandRecord ? (candidate.plan.commandBindings.get(commandRecord) ?? []) : [],
    )
    throwUnknownOptions(candidate.args, filter.optionsToKeyValue(targetOptions))
    const applicationRoot = this.commandGraph.nodes()[0]
    if (!action && !endpoint && candidate.match.node !== applicationRoot) {
      throw new InternalException(SYSTEM.NO_MATCHING_HANDLER, {
        details: { path: candidate.match.node.path },
        message: `Command "${candidate.match.node.path.join(' ')}" does not have a matching @Handler method.`,
      })
    }

    return {
      ...candidate,
      ...(action ? { action } : {}),
      effectiveOptions: Object.freeze(targetOptions.slice()),
      ...(endpoint ? { endpoint } : {}),
    }
  }

  private matchedActions(candidate: InvocationCandidate): ActionEndpoint[] {
    return candidate.plan.actions.filter(action =>
      Object.prototype.hasOwnProperty.call(
        candidate.args,
        `--${optionForAction(action).name}`,
      ),
    )
  }

  private throwUnknownInvocation(positionals: readonly string[]): never {
    const first = positionals[0]
    if (first && !first.startsWith('-')) {
      throw new InternalException(RUNTIME_PRINT.UNKNOWN_COMMAND, {
        details: { command: first, input: this.argv },
        message: `Unknown command "${first}".`,
        scope: ErrorScope.RUNTIME_PRINT,
      })
    }

    throw new InternalException(RUNTIME_PRINT.UNKNOWN_OPTION, {
      details: { options: positionals },
      message: `Unknown option${positionals.length > 1 ? 's' : ''}: ${positionals.join(', ')}.`,
      scope: ErrorScope.RUNTIME_PRINT,
    })
  }
}

export const resolveInvocation = (
  commandGraph: CommandGraph,
  argv: readonly string[],
): ResolvedInvocation => new InvocationResolver(commandGraph, argv).resolve()

const parse = (spec: arg.Spec, argv: readonly string[]): arg.Result<any> => {
  try {
    return arg(spec, { argv: argv.slice(), permissive: true })
  } catch (error) {
    throw new InternalException(RUNTIME_PRINT.PARSE, {
      cause: error instanceof Error ? error : undefined,
      details: { error },
      message: error instanceof Error ? error.message : String(error),
      scope: ErrorScope.RUNTIME_PRINT,
    })
  }
}

const validateNumberOptions = (
  options: readonly OptionParams[],
  args: arg.Result<any>,
) => {
  options.forEach(option => {
    const numberArray = Array.isArray(option.type) && option.type[0] === Number
    if (option.type !== Number && !numberArray) return
    const key = `--${option.name}`
    if (!Object.prototype.hasOwnProperty.call(args, key)) return
    const value: unknown = args[key]
    const values = Array.isArray(value) ? value : [value]
    if (values.every(item => typeof item === 'number' && Number.isFinite(item)))
      return

    throw new InternalException(RUNTIME_PRINT.PARSE, {
      details: { option: key, value },
      message: `Option "${key}" must be a finite number.`,
      scope: ErrorScope.RUNTIME_PRINT,
    })
  })
}

const throwUnknownOptions = (args: arg.Result<any>, spec: arg.Spec) => {
  const parsedOptions = Object.keys(args).filter(
    key => key.startsWith('--') && !Object.prototype.hasOwnProperty.call(spec, key),
  )
  const options = parsedOptions.concat(
    args._.filter(input => input.startsWith('-') && input !== '-'),
  )
  if (!options.length) return

  throw new InternalException(RUNTIME_PRINT.UNKNOWN_OPTION, {
    details: { options },
    message: `Unknown option${options.length > 1 ? 's' : ''}: ${options.join(', ')}.`,
    scope: ErrorScope.RUNTIME_PRINT,
  })
}

const normalizeError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error))
