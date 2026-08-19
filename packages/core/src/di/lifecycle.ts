import type { Context } from '../runtime/context'
import type { Exception } from '../shared/errors'
import type { CompiledModule } from './module-graph'

export interface OnInit {
  onInit(): Promise<void> | void
}

export interface LifecycleFault {
  readonly error: Error
  readonly instance: unknown
  readonly kind: string
  readonly name: string
  readonly owner: CompiledModule
}

export interface OnDispose {
  onDispose(): Promise<void> | void
}

export interface OnError {
  onError(exception: Exception, context: Context): Promise<void> | void
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
