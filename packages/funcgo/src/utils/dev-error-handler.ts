import { withErrorTrackingUrl } from './error-tracking'
import { formatSystemError, isSystemError } from './system-error-format'

const exitWithError = (error: unknown): never => {
  if (isSystemError(error)) {
    let message = formatSystemError(error, {
      cwd: process.cwd(),
      stream: process.stderr,
    })
    if (process.env.FUNCGO_DEBUG === '1' && error instanceof Error) {
      message = `${message}\n\n${error.stack}`
    }
    console.error(withErrorTrackingUrl(message, error))
    process.exit(1)
  }

  throw error
}

process.on('uncaughtException', exitWithError)
process.on('unhandledRejection', exitWithError)
