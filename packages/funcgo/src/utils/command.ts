import { spawn } from 'child_process'

export interface RunOptions {
  cwd?: string
  shell?: boolean
  stdio?: 'inherit' | 'ignore' | 'pipe'
  silentFailure?: boolean
}

export interface CommandFailureParams {
  args: string[]
  code: number | null
  command: string
  signal: NodeJS.Signals | null
  silent: boolean
}

export class CommandFailureError extends Error {
  public args: string[]
  public code: number | null
  public command: string
  public signal: NodeJS.Signals | null
  public silent: boolean

  constructor(params: CommandFailureParams) {
    super(`Command failed: ${params.command} ${params.args.join(' ')}`.trim())
    this.name = 'CommandFailureError'
    this.args = params.args
    this.code = params.code
    this.command = params.command
    this.signal = params.signal
    this.silent = params.silent
  }
}

export const isCommandFailureError = (error: unknown): error is CommandFailureError => {
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
      shell: options.shell || process.platform === 'win32',
      stdio: options.stdio || 'inherit',
    })

    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new CommandFailureError({
        args,
        code,
        command,
        signal,
        silent: options.silentFailure || false,
      }))
    })
  })
}
