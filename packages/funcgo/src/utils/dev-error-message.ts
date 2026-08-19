import { withErrorTrackingUrl } from './error-tracking'
import { formatSystemError, isSystemError } from './system-error-format'
import type { FormatErrorOptions } from './dev-error-format'

export interface DevErrorMessageOptions extends FormatErrorOptions {
  debug?: boolean
}

export const devErrorMessage = (
  error: unknown,
  options: DevErrorMessageOptions = {},
): string | undefined => {
  if (!isSystemError(error)) return undefined
  let message = formatSystemError(error, {
    cwd: options.cwd ?? process.cwd(),
    stream: options.stream ?? process.stderr,
  })
  const debug = options.debug ?? process.env.FUNCGO_DEBUG === '1'
  if (debug && error instanceof Error) message = `${message}\n\n${error.stack}`
  return withErrorTrackingUrl(message, error)
}
