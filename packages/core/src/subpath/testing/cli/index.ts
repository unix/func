import { spawn } from 'node:child_process'
import { resolveCliEntry } from './entry'
import type { CliLocationOptions } from './entry'
import type { Environment } from '../../../shared/environment'

export type { CliLocationOptions } from './entry'

export interface CliInvocationOptions {
  cwd?: string
  env?: Environment
  signal?: AbortSignal
  stdin?: string | Uint8Array
  timeoutMs?: number
}

export interface CliInvocationResult {
  readonly error: Error | undefined
  readonly exitCode: number | null
  readonly signal: NodeJS.Signals | null
  readonly stderr: string
  readonly stdout: string
  readonly timedOut: boolean
}

export interface CliRunner {
  run(
    argv?: readonly string[],
    options?: CliInvocationOptions,
  ): Promise<CliInvocationResult>
}

class ChildProcessCliRunner implements CliRunner {
  constructor(private readonly entry: string) {}

  run(
    argv: readonly string[] = [],
    options: CliInvocationOptions = {},
  ): Promise<CliInvocationResult> {
    assertArgv(argv)
    assertTimeout(options.timeoutMs)

    return new Promise(resolve => {
      const stderr: Buffer[] = []
      const stdout: Buffer[] = []
      const child = spawn(process.execPath, [this.entry, ...argv], {
        cwd: options.cwd,
        env: options.env ?? {},
        signal: options.signal,
        stdio: 'pipe',
      })
      let error: Error | undefined
      let timedOut = false
      const timeout = options.timeoutMs
        ? setTimeout(() => {
            timedOut = true
            child.kill('SIGTERM')
          }, options.timeoutMs)
        : undefined

      child.stdout.on('data', (chunk: Uint8Array) => stdout.push(Buffer.from(chunk)))
      child.stderr.on('data', (chunk: Uint8Array) => stderr.push(Buffer.from(chunk)))
      child.stdin.on('error', () => {})
      child.once('error', cause => {
        error = cause
      })
      child.once('close', (exitCode, signal) => {
        if (timeout) clearTimeout(timeout)
        resolve({
          error,
          exitCode,
          signal,
          stderr: Buffer.concat(stderr).toString('utf8'),
          stdout: Buffer.concat(stdout).toString('utf8'),
          timedOut,
        })
      })

      child.stdin.end(options.stdin)
    })
  }
}

export const createCliRunner = (options: CliLocationOptions = {}): CliRunner =>
  new ChildProcessCliRunner(resolveCliEntry(options))

const assertArgv = (argv: readonly string[]) => {
  if (Array.isArray(argv) && argv.every(value => typeof value === 'string')) return
  throw new TypeError('CLI argv must be an array of strings.')
}

const assertTimeout = (timeoutMs: number | undefined) => {
  if (timeoutMs === undefined) return
  if (Number.isSafeInteger(timeoutMs) && timeoutMs > 0) return
  throw new TypeError('CLI timeoutMs must be a positive integer.')
}
