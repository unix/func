#!/usr/bin/env node
import { isException } from '@func/contracts/exception'
import { ScaffoldErrorScope } from '@func/contracts/scaffold-errors'
import { main } from './index'

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  const hint = scaffoldErrorHint(error)
  console.error(hint ? `${message}\n\n${hint}` : message)
  process.exit(1)
})

const scaffoldErrorHint = (error: unknown): string | undefined => {
  if (!isException(error) || error.scope !== ScaffoldErrorScope) return undefined
  return `Learn how to fix this error: https://f.witt.im/${error.code.slice(2)}`
}
