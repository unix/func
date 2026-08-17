import {
  ErrorScope,
  formatErrorCode,
  type ErrorCode,
} from '@func/contracts/core-errors'
import {
  Exception as ContractException,
  isException as isContractException,
  type ExceptionDetails,
  type ExceptionOptions as ContractExceptionOptions,
} from '@func/contracts/exception'

export { ErrorScope }

export type ExceptionCode<Code extends string = string> = ErrorCode<ErrorScope, Code>

export type { ExceptionDetails }

export interface ExceptionOptions extends ContractExceptionOptions {
  scope?: ErrorScope
}

export class Exception<Code extends string = string> extends ContractException<
  ErrorScope,
  Code
> {
  constructor(code: Code, options: ExceptionOptions | string = {}) {
    const normalizedOptions = normalizeExceptionOptions(options)
    const { scope = ErrorScope.RUNTIME, ...contractOptions } = normalizedOptions
    super(scope, code, contractOptions)
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
  isContractException(error) && isErrorScope(error.scope)

const normalizeExceptionOptions = (
  options: ExceptionOptions | string,
): ExceptionOptions => (typeof options === 'string' ? { message: options } : options)

const isErrorScope = (value: string): value is ErrorScope =>
  Object.values(ErrorScope).some(scope => scope === value)
