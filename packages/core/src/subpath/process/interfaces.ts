import type { ExceptionOptions } from '../../shared/errors'

export interface ProcessOptions {
  acceptedExitCodes?: readonly number[]
  cwd?: string
  env?: Readonly<Record<string, string | undefined>>
  label?: string
  sensitive?: boolean
  signal?: AbortSignal
  timeoutMs?: number
}

export interface ProcessCaptureOptions extends ProcessOptions {
  encoding?: BufferEncoding
  input?: string | Uint8Array
  maxOutputBytes?: number
}

export type ProcessForwardOptions = ProcessOptions

export interface ProcessStatus {
  readonly durationMs: number
  readonly exitCode: number
}

export interface ProcessCaptureResult extends ProcessStatus {
  readonly stderr: string
  readonly stdout: string
}

export interface ProcessFailureResult {
  readonly durationMs: number
  readonly exitCode: number | null
  readonly signal: NodeJS.Signals | null
  readonly stderr?: string
  readonly stdout?: string
}

export interface ProcessExceptionOptions extends Omit<
  ExceptionOptions,
  'name' | 'scope'
> {
  result?: ProcessFailureResult
}
