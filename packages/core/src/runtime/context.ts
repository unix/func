import { RUNTIME } from '@func/contracts/core-errors'
import type { Readable, Writable } from 'node:stream'
import type { CommandInfo } from '../commands/command-info'
import type { CommandNode } from '../commands/graph/model'
import type { CommandGraph } from '../commands/graph/runtime'
import { environment } from '../shared/environment'
import type { Environment } from '../shared/environment'
import type { ArgsOptionValue } from './args'
import { ErrorScope, InternalException } from '../shared/errors'

export interface ContextIO {
  readonly stderr: Writable
  readonly stdin: Readable
  readonly stdout: Writable
}

interface ContextState {
  command?: CommandInfo
  commandGraph?: CommandGraph
  commandNode?: CommandNode
  env: Environment
  exitCode: number
  exitCodeChanged: boolean
  options: Readonly<Record<string, ArgsOptionValue>>
  resultOutput: 'return' | 'stdout'
  settled: boolean
}

export interface ContextInvocation {
  readonly commandGraph: CommandGraph
  readonly commandNode: CommandNode
}

const contextStates = new WeakMap<Context, ContextState>()

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
    this.argv = Object.freeze((options.argv ?? []).slice())
    this.commands = commands
    contextStates.set(this, {
      env: environment.normalize(options.env ?? process.env),
      exitCode: 0,
      exitCodeChanged: false,
      options: Object.freeze({}),
      resultOutput: 'return',
      settled: false,
    })
  }

  get command(): CommandInfo | undefined {
    return contextState(this).command
  }

  get env(): Environment {
    return contextState(this).env
  }

  get exitCode(): number {
    return contextState(this).exitCode
  }

  get options(): Readonly<Record<string, ArgsOptionValue>> {
    return contextState(this).options
  }

  get resultOutput(): 'return' | 'stdout' {
    return contextState(this).resultOutput
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

export const settleContext = (context: Context) => {
  contextState(context).settled = true
}

export const failContext = (context: Context) => {
  const state = contextState(context)
  if (state.exitCodeChanged) return
  state.exitCode = 1
}

export const selectContextCommand = (context: Context, command?: CommandInfo) => {
  contextState(context).command = command
}

export const selectContextInvocation = (
  context: Context,
  commandGraph: CommandGraph,
  commandNode: CommandNode,
) => {
  const state = contextState(context)
  state.commandGraph = commandGraph
  state.commandNode = commandNode
}

export const selectContextOptions = (
  context: Context,
  options: Readonly<Record<string, ArgsOptionValue>>,
) => {
  contextState(context).options = Object.freeze({ ...options })
}

export const selectContextResultOutput = (
  context: Context,
  output: 'return' | 'stdout',
) => {
  contextState(context).resultOutput = output
}

export const contextInvocation = (context: Context): ContextInvocation => {
  const state = contextState(context)
  if (state.commandGraph && state.commandNode) {
    return {
      commandGraph: state.commandGraph,
      commandNode: state.commandNode,
    }
  }

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
