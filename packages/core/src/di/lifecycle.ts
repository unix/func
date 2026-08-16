import type { ExceptionContext } from '../runtime/context'
import type { Exception } from '../shared/errors'

export interface OnInit {
  onInit(): Promise<void> | void
}

export type ExecutionOutcome<T = unknown> =
  | Readonly<{
      exitCode: number
      result: T
      status: 'success'
    }>
  | Readonly<{
      error: Exception
      exitCode: number
      handled: boolean
      status: 'error'
    }>

export interface OnError {
  onError(exception: Exception, context: ExceptionContext): Promise<void> | void
}

export interface OnDispose<T = unknown> {
  onDispose(outcome: ExecutionOutcome<T>): Promise<void> | void
}

export const hasOnInit = (value: unknown): value is OnInit =>
  Boolean(
    value &&
    (typeof value === 'object' || typeof value === 'function') &&
    'onInit' in value &&
    typeof value.onInit === 'function',
  )

export const hasOnDispose = (value: unknown): value is OnDispose =>
  Boolean(
    value &&
    (typeof value === 'object' || typeof value === 'function') &&
    'onDispose' in value &&
    typeof value.onDispose === 'function',
  )

export const hasOnError = (value: unknown): value is OnError =>
  Boolean(
    value &&
    (typeof value === 'object' || typeof value === 'function') &&
    'onError' in value &&
    typeof value.onError === 'function',
  )
