import path from 'path'
import type { SystemErrorCode } from '@func/shared/system-errors'
import { formatCodeFrame } from './dev-error-code-frame'
import { resolveErrorLocation } from './dev-error-location'
import { style } from './style'
import type { StyleStream } from './style'

interface FuncErrorLike {
  code?: unknown
  details?: unknown
  message?: unknown
  name?: unknown
  stack?: unknown
}

export interface FormatErrorOptions {
  cwd?: string
  stream?: StyleStream
}

const CANNOT_INFER_VALUE_TYPE = 'cannot-infer-value-type'
const CANNOT_INFER_VALUE_TYPE_CODE =
  'F_SYSTEM_CANNOT_INFER_VALUE_TYPE' satisfies SystemErrorCode
const INVALID_PARAM_TYPE_CODE =
  'F_SYSTEM_INVALID_PARAM_TYPE' satisfies SystemErrorCode

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

export const isCannotInferValueTypeError = (
  error: unknown,
): error is FuncErrorLike => {
  if (!isRecord(error)) return false
  if (error.code === CANNOT_INFER_VALUE_TYPE_CODE) return true
  if (error.code !== INVALID_PARAM_TYPE_CODE) return false
  if (!isRecord(error.details)) return false
  if (typeof error.details.property !== 'string' || !error.details.property)
    return false
  if (error.details.reason === CANNOT_INFER_VALUE_TYPE) return true
  if (typeof error.message !== 'string') return false

  return error.message.includes(
    `Cannot infer value type for "${error.details.property}"`,
  )
}

export const formatCannotInferValueTypeError = (
  error: FuncErrorLike,
  options: FormatErrorOptions = {},
): string => {
  const details = isRecord(error.details) ? error.details : {}
  const property = typeof details.property === 'string' ? details.property : 'value'
  const className =
    typeof details.className === 'string' ? details.className : undefined
  const subject = className ? `${className}.${property}` : property
  const cwd = options.cwd || process.cwd()
  const stream = options.stream || process.stderr
  const location = resolveErrorLocation(error, { cwd, property })
  const locationContext = formatLocationContext(location, cwd, property, stream)

  return [
    style.error(
      `Cannot automatically infer the runtime type for "${subject}".`,
      stream,
    ),
    ...locationContext,
    '',
    style.warning(
      'Please specify the type explicitly in the option decorator:',
      stream,
    ),
    `  ${style.accent('@Value({ type: String })', stream)}`,
    `  ${style.accent(`${property}!: string`, stream)}`,
  ].join('\n')
}

const formatLocationContext = (
  location: ReturnType<typeof resolveErrorLocation>,
  cwd: string,
  property: string,
  stream: StyleStream,
): string[] => {
  if (!location) return []

  const relativeFile = path.relative(cwd, location.file).replace(/\\/g, '/')
  const codeFrame = formatCodeFrame(location, { highlight: property, stream })
  const context = [
    '',
    `  ${style.accent(`${relativeFile}:${location.line}:${location.column}`, stream)}`,
  ]
  if (codeFrame) context.push('', codeFrame)

  return context
}
