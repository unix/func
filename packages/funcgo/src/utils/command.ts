import { SCAFFOLD, ScaffoldException } from '@func/contracts/scaffold-errors'
import { spawn } from 'child_process'

export interface RunOptions {
  cwd?: string
  shell?: boolean
  stdio?: 'inherit' | 'ignore' | 'pipe'
  silentFailure?: boolean
}

export interface CommandFailureParams {
  args: string[]
  cause?: Error
  code: number | null
  command: string
  signal: NodeJS.Signals | null
  silent: boolean
}

export interface CommandFailure {
  readonly exitCode: number | null
  readonly silent: boolean
}

class CommandFailureError extends ScaffoldException<SCAFFOLD.COMMAND_FAILED> {
  readonly args: string[]
  readonly command: string
  readonly exitCode: number | null
  readonly signal: NodeJS.Signals | null
  readonly silent: boolean

  constructor(params: CommandFailureParams) {
    super(SCAFFOLD.COMMAND_FAILED, {
      ...(params.cause ? { cause: params.cause } : {}),
      details: {
        args: params.args,
        command: params.command,
        exitCode: params.code,
        signal: params.signal,
      },
      message:
        params.cause?.message ??
        `Command failed: ${params.command} ${params.args.join(' ')}`.trim(),
    })
    this.name = 'CommandFailureError'
    this.args = params.args
    this.command = params.command
    this.exitCode = params.code
    this.signal = params.signal
    this.silent = params.silent
  }
}

export const isCommandFailureError = (error: unknown): error is CommandFailure => {
  return error instanceof CommandFailureError
}

export const run = (
  command: string,
  args: string[] = [],
  options: RunOptions = {},
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: options.shell ?? process.platform === 'win32',
      stdio: options.stdio ?? 'inherit',
    })

    child.on('error', cause => {
      reject(
        new CommandFailureError({
          args,
          cause,
          code: null,
          command,
          signal: null,
          silent: options.silentFailure ?? false,
        }),
      )
    })
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new CommandFailureError({
          args,
          code,
          command,
          signal,
          silent: options.silentFailure ?? false,
        }),
      )
    })
  })
}
