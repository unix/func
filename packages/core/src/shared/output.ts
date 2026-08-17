import { SYSTEM } from '@func/contracts/core-errors'
import { InternalException } from './errors'

export type TextOutput = 'return' | 'stdout'

export const normalizeTextOutput = (value: unknown): TextOutput => {
  if (value === undefined || value === 'return') return 'return'
  if (value === 'stdout') return 'stdout'
  throw new InternalException(SYSTEM.INVALID_TEXT_OUTPUT, {
    details: { textOutput: value },
  })
}
