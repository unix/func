#!/usr/bin/env node
import { main } from './index'
import { withErrorTrackingUrl } from './utils/error-tracking'
import { style } from './utils/style'
import { formatSystemError, isSystemError } from './utils/system-error-format'

main().catch(error => {
  const message = isSystemError(error)
    ? formatSystemError(error)
    : style.error(error instanceof Error ? error.message : String(error))
  console.error(withErrorTrackingUrl(message, error))
  process.exit(1)
})
