interface FuncErrorLike {
  code?: unknown
  details?: unknown
  message?: unknown
  name?: unknown
}

const CANNOT_INFER_VALUE_TYPE = 'cannot-infer-value-type'
const INVALID_PARAM_TYPE_CODE = 'F_SYSTEM_INVALID_PARAM_TYPE'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

export const isCannotInferValueTypeError = (error: unknown): error is FuncErrorLike => {
  if (!isRecord(error)) return false
  if (error.code !== INVALID_PARAM_TYPE_CODE) return false
  if (!isRecord(error.details)) return false
  if (typeof error.details.property !== 'string' || !error.details.property) return false
  if (error.details.reason === CANNOT_INFER_VALUE_TYPE) return true
  if (typeof error.message !== 'string') return false

  return error.message.includes(`Cannot infer value type for "${error.details.property}"`)
}

export const formatCannotInferValueTypeError = (error: FuncErrorLike): string => {
  const details = isRecord(error.details) ? error.details : {}
  const property = typeof details.property === 'string' ? details.property : 'value'

  return [
    `Cannot automatically infer the type for "${property}".`,
    '',
    'Please specify the type explicitly in the option decorator:',
    `  @Value({ type: String })`,
    `  ${property}!: string`,
  ].join('\n')
}
