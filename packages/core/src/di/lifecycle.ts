export interface OnInit {
  onInit(): Promise<void> | void
}

export interface LifecycleFault {
  readonly error: Error
  readonly kind: string
  readonly name: string
}

export interface OnDispose {
  onDispose(): Promise<void> | void
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
