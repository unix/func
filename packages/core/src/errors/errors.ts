import type { FuncErrorCode } from './constants'
import {
  F_RUNTIME,
  errorLevels,
  errorTypes,
} from './constants'

export interface FuncErrorDetails {
  [key: string]: any
}

export interface FuncErrorParams {
  code: FuncErrorCode
  details?: FuncErrorDetails
  level: errorLevels
  message: string
  type: errorTypes
  cause?: Error
}

export class FuncError extends Error {
  public cause?: Error
  public code: FuncErrorCode
  public details: FuncErrorDetails
  public level: errorLevels
  public type: errorTypes

  constructor(params: FuncErrorParams) {
    super(params.message)
    this.name = 'FuncError'
    this.code = params.code
    this.details = params.details || {}
    this.level = params.level
    this.type = params.type
    this.cause = params.cause
  }
}

export const isFuncError = (error: unknown): error is FuncError => error instanceof FuncError

export const createSystemError = (
  code: FuncErrorCode,
  type: errorTypes,
  message: string,
  details: FuncErrorDetails = {},
  cause?: Error,
) =>
  new FuncError({
    code,
    details,
    level: errorLevels.SYSTEM,
    message,
    type,
    cause,
  })

export const createRuntimeError = (
  code: FuncErrorCode,
  type: errorTypes,
  message: string,
  details: FuncErrorDetails = {},
  cause?: Error,
) =>
  new FuncError({
    code,
    details,
    level: errorLevels.RUNTIME,
    message,
    type,
    cause,
  })

export const createRuntimePrintError = (
  code: FuncErrorCode,
  type: errorTypes,
  message: string,
  details: FuncErrorDetails = {},
  cause?: Error,
) =>
  new FuncError({
    code,
    details,
    level: errorLevels.RUNTIME_PRINT,
    message,
    type,
    cause,
  })

export const normalizeRuntimeError = (error: unknown): FuncError => {
  if (isFuncError(error)) return error
  const nativeError = error instanceof Error ? error : new Error(String(error))

  return createRuntimeError(
    F_RUNTIME.HANDLER_ERROR,
    errorTypes.HANDLER,
    nativeError.message,
    { error: nativeError },
    nativeError,
  )
}

export const handleSystemError = (error: FuncError): never => {
  throw error
}

export const handleRuntimePrintError = (error: FuncError, printPrevented: boolean) => {
  if (printPrevented) return

  console.error(error.message)
}

export const handleEffect = (
  code: FuncErrorCode,
  type: errorTypes,
  message: string,
  details: FuncErrorDetails = {},
) => {
  const error = new FuncError({
    code,
    details,
    level: errorLevels.EFFECT,
    message,
    type,
  })
  console.warn(error.message)
  return error
}
