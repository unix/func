const ERROR_TRACKING_BASE_URL = 'https://f.witt.im'
const ERROR_CODE_PATTERN = /^F_(?:SCAFFOLD|SYSTEM)_[A-Z0-9_]+$/
const ERROR_CODE_PREFIX = 'F_'
const SYSTEM_ERROR_CODE_PREFIX = 'F_SYSTEM_'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const trackedErrorCode = (
  error: unknown,
  visited = new Set<object>(),
): string | undefined => {
  if (!isRecord(error)) return undefined
  if (visited.has(error)) return undefined
  visited.add(error)
  const { cause, code, errors, pluginCode } = error
  const directCode = [code, pluginCode].find(value => {
    return typeof value === 'string' && ERROR_CODE_PATTERN.test(value)
  })
  if (typeof directCode === 'string') return directCode

  if (Array.isArray(errors)) {
    for (const nestedError of errors) {
      const nestedCode = trackedErrorCode(nestedError, visited)
      if (nestedCode) return nestedCode
    }
  }

  return trackedErrorCode(cause, visited)
}

export const errorTrackingUrl = (error: unknown): string | undefined => {
  const code = trackedErrorCode(error)
  if (!code) return undefined
  const path = code.startsWith(SYSTEM_ERROR_CODE_PREFIX)
    ? code.slice(SYSTEM_ERROR_CODE_PREFIX.length)
    : code.slice(ERROR_CODE_PREFIX.length)
  return `${ERROR_TRACKING_BASE_URL}/${path}`
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
