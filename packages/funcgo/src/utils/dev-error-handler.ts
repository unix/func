import {
  formatCannotInferValueTypeError,
  isCannotInferValueTypeError,
} from './dev-error-format'
import { errorTrackingHint, withErrorTrackingUrl } from './error-tracking'

const exitWithError = (error: unknown): never => {
  if (isCannotInferValueTypeError(error)) {
    let message = formatCannotInferValueTypeError(error, {
      cwd: process.cwd(),
      stream: process.stderr,
    })
    if (process.env.FUNCGO_DEBUG === '1' && error instanceof Error) {
      message = `${message}\n\n${error.stack}`
    }
    console.error(withErrorTrackingUrl(message, error))
    process.exit(1)
  }

  const trackingHint = errorTrackingHint(error)
  if (!trackingHint) throw error

  console.error(error)
  console.error('')
  console.error(trackingHint)
  process.exit(1)
}

process.on('uncaughtException', exitWithError)
process.on('unhandledRejection', exitWithError)
