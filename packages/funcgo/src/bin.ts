#!/usr/bin/env node
import { main } from './index'
import { withErrorTrackingUrl } from './utils/error-tracking'
import { style } from './utils/style'

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(withErrorTrackingUrl(style.error(message), error))
  process.exit(1)
})
