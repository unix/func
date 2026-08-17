const exceptionBrand = Symbol.for('func-exception')

export type ExceptionCode<
  Scope extends string = string,
  Code extends string = string,
> = `${Scope}_${Code}`

export type ExceptionDetails = Record<string, unknown>

export interface ExceptionOptions {
  cause?: Error
  details?: ExceptionDetails
  message?: string
  name?: string
}

export class Exception<
  Scope extends string = string,
  Code extends string = string,
> extends Error {
  readonly code: ExceptionCode<Scope, Code>
  readonly details: ExceptionDetails
  readonly scope: Scope

  constructor(scope: Scope, code: Code, options: ExceptionOptions | string = {}) {
    const normalizedOptions = normalizeExceptionOptions(options)
    const formattedCode = formatExceptionCode(scope, code)
    super(normalizedOptions.message ?? formattedCode, {
      cause: normalizedOptions.cause,
    })
    Object.defineProperty(this, exceptionBrand, { value: true })
    this.name = normalizedOptions.name ?? 'Exception'
    this.code = formattedCode
    this.details = normalizedOptions.details ?? {}
    this.scope = scope
  }
}

export const formatExceptionCode = <Scope extends string, Code extends string>(
  scope: Scope,
  code: Code,
): ExceptionCode<Scope, Code> => `${scope}_${code}`

export const isException = (error: unknown): error is Exception => {
  if (!error || typeof error !== 'object') return false
  const brand = readProperty(error, exceptionBrand)
  const scope = readProperty(error, 'scope')
  const code = readProperty(error, 'code')
  const message = readProperty(error, 'message')
  const details = readProperty(error, 'details')
  if (brand !== true) return false
  if (typeof scope !== 'string') return false
  if (typeof code !== 'string') return false
  if (!code.startsWith(`${scope}_`)) return false
  return typeof message === 'string' && isExceptionDetails(details)
}

const normalizeExceptionOptions = (
  options: ExceptionOptions | string,
): ExceptionOptions => (typeof options === 'string' ? { message: options } : options)

const isExceptionDetails = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readProperty = (value: object, key: PropertyKey): unknown =>
  Reflect.get(value, key)
