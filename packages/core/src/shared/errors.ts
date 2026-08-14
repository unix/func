import {
  ErrorScope,
  formatErrorCode,
  type ErrorCode,
} from '@func/shared/core-errors'
import type { Writable } from 'node:stream'

export { ErrorScope }

export type ExceptionCode<Code extends string = string> = ErrorCode<ErrorScope, Code>

export type ExceptionDetails = Record<string, unknown>

export interface ExceptionOptions {
  cause?: Error
  details?: ExceptionDetails
  message?: string
  name?: string
  scope?: ErrorScope
}

export interface SerializedException<Code extends string = string> {
  cause?: {
    message: string
    name: string
  }
  code: ExceptionCode<Code>
  details: ExceptionDetails
  message: string
  name: string
  scope: ErrorScope
  stack?: string
}

export class Exception<Code extends string = string> extends Error {
  readonly code: ExceptionCode<Code>
  readonly details: ExceptionDetails
  readonly scope: ErrorScope

  constructor(code: Code, options: ExceptionOptions | string = {}) {
    const normalizedOptions = normalizeExceptionOptions(options)
    const scope = normalizedOptions.scope ?? ErrorScope.RUNTIME
    const formattedCode = formatExceptionCode(scope, code)
    super(normalizedOptions.message ?? formattedCode, {
      cause: normalizedOptions.cause,
    })
    this.name = normalizedOptions.name ?? 'Exception'
    this.code = formattedCode
    this.details = normalizedOptions.details ?? {}
    this.scope = scope
  }

  toJSON(): SerializedException<Code> {
    return {
      ...(this.cause instanceof Error
        ? { cause: { message: this.cause.message, name: this.cause.name } }
        : {}),
      code: this.code,
      details: this.details,
      message: this.message,
      name: this.name,
      scope: this.scope,
      ...(this.stack ? { stack: this.stack } : {}),
    }
  }
}

export type InternalExceptionOptions = Omit<ExceptionOptions, 'name'>

export class InternalException<
  Code extends string = string,
> extends Exception<Code> {
  constructor(code: Code, options: InternalExceptionOptions | string = {}) {
    const normalizedOptions = normalizeExceptionOptions(options)
    super(code, {
      ...normalizedOptions,
      name: 'InternalException',
      scope: normalizedOptions.scope ?? ErrorScope.SYSTEM,
    })
  }
}

export const formatExceptionCode = formatErrorCode

export const isException = (error: unknown): error is Exception =>
  error instanceof Exception

export const printException = (
  exception: Exception,
  output: Writable = process.stderr,
) => {
  output.write(`${exception.message}\n`)
}

const normalizeExceptionOptions = (
  options: ExceptionOptions | string,
): ExceptionOptions => (typeof options === 'string' ? { message: options } : options)
