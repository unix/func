import { RUNTIME } from '@func/contracts/core-errors'
import type { Readable, Writable } from 'node:stream'
import type { CommandInfo } from '../commands/command-info'
import type { CommandNode } from '../commands/graph/model'
import type { CommandGraph } from '../commands/graph/runtime'
import { environment } from '../shared/environment'
import type { Environment } from '../shared/environment'
import type { ArgsOptionValue } from './args'
import type { Args } from './args'
import { ErrorScope, InternalException } from '../shared/errors'

export interface ContextIO {
  readonly stderr: Writable
  readonly stdin: Readable
  readonly stdout: Writable
}

interface ContextState {
  env: Environment
  exitCode: number
  exitCodeChanged: boolean
  invocation: ContextInvocation
  settled: boolean
}

export type ContextInvocation =
  | Readonly<{
      resolved: false
    }>
  | ResolvedContextInvocation

export interface ResolvedContextInvocation {
  readonly args: Args
  readonly command?: CommandInfo
  readonly commandGraph: CommandGraph
  readonly commandNode: CommandNode
  readonly resolved: true
}

const contextStates = new WeakMap<Context, ContextState>()
const unresolvedInvocation: ContextInvocation = Object.freeze({ resolved: false })

export class Context {
  readonly appName?: string
  readonly argv: readonly string[]
  readonly commands: readonly CommandInfo[]

  constructor(
    commands: readonly CommandInfo[],
    readonly io: ContextIO,
    readonly cwd: string,
    readonly signal: AbortSignal,
    options: { appName?: string; argv?: readonly string[]; env?: Environment } = {},
  ) {
    this.appName = options.appName
    this.argv = immutableArgv(options.argv ?? [])
    this.commands = commands
    contextStates.set(this, {
      env: environment.normalize(options.env ?? process.env),
      exitCode: 0,
      exitCodeChanged: false,
      invocation: unresolvedInvocation,
      settled: false,
    })
  }

  get command(): CommandInfo | undefined {
    const invocation = this.invocation
    return invocation.resolved ? invocation.command : undefined
  }

  get env(): Environment {
    return contextState(this).env
  }

  get exitCode(): number {
    return contextState(this).exitCode
  }

  get invocation(): ContextInvocation {
    return contextState(this).invocation
  }

  get options(): Readonly<Record<string, ArgsOptionValue>> {
    const invocation = this.invocation
    if (!invocation.resolved) return Object.freeze({})
    return invocation.args.options
  }

  set exitCode(value: number) {
    const state = contextState(this)
    if (state.settled) {
      throw new InternalException(RUNTIME.INVALID_CONTEXT, {
        message: 'Context.exitCode cannot change after invocation settlement.',
        scope: ErrorScope.RUNTIME,
      })
    }

    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new InternalException(RUNTIME.INVALID_EXIT_CODE, {
        details: { exitCode: value },
        message: 'Context.exitCode must be an integer between 0 and 255.',
        scope: ErrorScope.RUNTIME,
      })
    }

    state.exitCode = value
    state.exitCodeChanged = true
  }
}

const immutableArgv = (argv: readonly string[]): readonly string[] =>
  Object.isFrozen(argv) ? argv : Object.freeze(argv.slice())

export const settleContext = (context: Context) => {
  contextState(context).settled = true
}

export const failContext = (context: Context) => {
  const state = contextState(context)
  if (state.exitCodeChanged) return
  state.exitCode = 1
}

export const selectContextInvocation = (
  context: Context,
  args: Args,
  commandGraph: CommandGraph,
  commandNode: CommandNode,
  command?: CommandInfo,
) => {
  contextState(context).invocation = Object.freeze({
    args,
    ...(command ? { command } : {}),
    commandGraph,
    commandNode,
    resolved: true,
  })
}

export const contextInvocation = (context: Context): ResolvedContextInvocation => {
  const invocation = context.invocation
  if (invocation.resolved) return invocation

  throw new InternalException(RUNTIME.INVALID_CONTEXT, {
    message: 'Context does not have an active invocation.',
    scope: ErrorScope.RUNTIME,
  })
}

const contextState = (context: Context): ContextState => {
  const state = contextStates.get(context)
  if (state) return state
  throw new InternalException(RUNTIME.INVALID_CONTEXT, {
    message: 'Context was not created by the func runtime.',
    scope: ErrorScope.RUNTIME,
  })
}
