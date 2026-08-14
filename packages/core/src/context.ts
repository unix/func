import type { Readable, Writable } from 'node:stream'
import type { CommandGraph, CommandNode } from './containers/command-graph'
import type { RegisterCommandParams } from './interfaces'

export class ExceptionContext {
  private defaultPrintPrevented = false

  get printPrevented(): boolean {
    return this.defaultPrintPrevented
  }

  preventDefaultPrint() {
    this.defaultPrintPrevented = true
  }
}

type DeepReadonly<T> = T extends (...args: any[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T

export type CommandInfo = DeepReadonly<RegisterCommandParams>

export class CommandCatalog {
  constructor(readonly commands: readonly CommandInfo[]) {}
}

export interface ContextIO {
  readonly stderr: Writable
  readonly stdin: Readable
  readonly stdout: Writable
}

interface ContextState {
  command?: CommandInfo
  commandGraph?: CommandGraph
  commandNode?: CommandNode
  exitCode: number
  exitCodeChanged: boolean
}

export interface ContextInvocation {
  readonly commandGraph: CommandGraph
  readonly commandNode: CommandNode
}

const contextStates = new WeakMap<Context, ContextState>()

export class Context {
  readonly commands: readonly CommandInfo[]

  constructor(
    commandCatalog: CommandCatalog,
    readonly io: ContextIO,
    readonly cwd: string,
    readonly signal: AbortSignal,
  ) {
    this.commands = commandCatalog.commands
    contextStates.set(this, {
      exitCode: 0,
      exitCodeChanged: false,
    })
  }

  get command(): CommandInfo | undefined {
    return contextState(this).command
  }

  get exitCode(): number {
    return contextState(this).exitCode
  }

  set exitCode(value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new RangeError('Context.exitCode must be an integer between 0 and 255.')
    }

    const state = contextState(this)
    state.exitCode = value
    state.exitCodeChanged = true
  }
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

export const contextInvocation = (context: Context): ContextInvocation => {
  const state = contextState(context)
  if (state.commandGraph && state.commandNode) {
    return {
      commandGraph: state.commandGraph,
      commandNode: state.commandNode,
    }
  }

  throw new TypeError('Context does not have an active invocation.')
}

const contextState = (context: Context): ContextState => {
  const state = contextStates.get(context)
  if (state) return state
  throw new TypeError('Context was not created by the func runtime.')
}

export const createCommandInfo = (command: RegisterCommandParams): CommandInfo =>
  Object.freeze({
    ...command,
    aliases: Object.freeze(command.aliases.slice()),
    ...(command.fieldOptions
      ? {
          fieldOptions: Object.freeze(command.fieldOptions.map(readonlyFieldOption)),
        }
      : {}),
    path: Object.freeze(command.path.slice()),
  })

const readonlyFieldOption = (
  option: NonNullable<RegisterCommandParams['fieldOptions']>[number],
): DeepReadonly<NonNullable<RegisterCommandParams['fieldOptions']>[number]> => {
  const fieldOption = { ...option } as typeof option & { validators?: unknown }
  delete fieldOption.validators
  const constraints = {
    ...(fieldOption.dependsOn
      ? { dependsOn: Object.freeze(fieldOption.dependsOn.slice()) }
      : {}),
    ...(fieldOption.enum ? { enum: Object.freeze(fieldOption.enum.slice()) } : {}),
    ...(fieldOption.exclusive
      ? { exclusive: Object.freeze(fieldOption.exclusive.slice()) }
      : {}),
  }
  const aliases = Object.freeze(fieldOption.aliases.slice())
  if (fieldOption.kind === 'array') {
    return Object.freeze({
      ...fieldOption,
      aliases,
      ...constraints,
      type: Object.freeze(fieldOption.type.slice()),
    })
  }
  return Object.freeze({ ...fieldOption, aliases, ...constraints })
}
