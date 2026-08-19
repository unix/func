import { devErrorMessage } from './dev-error-message'

const exitWithError = (error: unknown): never => {
  const message = devErrorMessage(error)
  if (message) {
    console.error(message)
    process.exit(1)
  }

  throw error
}

process.on('uncaughtException', exitWithError)
process.on('unhandledRejection', exitWithError)
