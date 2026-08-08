const ERROR_TRACKING_BASE_URL = 'https://f.witt.im'
const SYSTEM_ERROR_CODE_PREFIX = 'F_SYSTEM_'
const SYSTEM_ERROR_CODE_PATTERN = /^F_SYSTEM_[A-Z0-9_]+$/

interface ErrorCodeLike {
  cause?: unknown
  code?: unknown
  errors?: unknown
  pluginCode?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const systemErrorCode = (
  error: unknown,
  visited = new Set<object>(),
): string | undefined => {
  if (!isRecord(error)) return undefined
  if (visited.has(error)) return undefined
  visited.add(error)
  const { cause, code, errors, pluginCode } = error as ErrorCodeLike
  const directCode = [code, pluginCode].find(value => {
    return typeof value === 'string' && SYSTEM_ERROR_CODE_PATTERN.test(value)
  }) as string | undefined
  if (directCode) return directCode

  if (Array.isArray(errors)) {
    for (const nestedError of errors) {
      const nestedCode = systemErrorCode(nestedError, visited)
      if (nestedCode) return nestedCode
    }
  }

  return systemErrorCode(cause, visited)
}

export const errorTrackingUrl = (error: unknown): string | undefined => {
  const code = systemErrorCode(error)
  if (!code) return undefined
  return `${ERROR_TRACKING_BASE_URL}/${code.slice(SYSTEM_ERROR_CODE_PREFIX.length)}`
}

export const errorTrackingHint = (error: unknown): string | undefined => {
  const trackingUrl = errorTrackingUrl(error)
  if (!trackingUrl) return undefined
  return `Learn how to fix this error: ${trackingUrl}`
}

export const withErrorTrackingUrl = (message: string, error: unknown): string => {
  const trackingHint = errorTrackingHint(error)
  if (!trackingHint || message.endsWith(trackingHint)) return message
  return `${message}\n\n${trackingHint}`
}
