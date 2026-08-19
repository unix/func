import path from 'path'

export const resolveDevErrorHandler = (): string =>
  path.resolve(__dirname, 'dev-error-handler')
