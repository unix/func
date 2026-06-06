import {
  formatCannotInferValueTypeError,
  isCannotInferValueTypeError,
} from './dev-error-format'

const exitWithError = (error: unknown): never => {
  if (isCannotInferValueTypeError(error)) {
    console.error(formatCannotInferValueTypeError(error))
    process.exit(1)
  }

  throw error
}

process.on('uncaughtException', exitWithError)
process.on('unhandledRejection', exitWithError)
