import { SYSTEM } from '@func/contracts/core-errors'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { InternalException } from '../../shared/errors'
import { isSafePathSegment } from './path-segment'

export const applicationDirectory = (appName: unknown): string => {
  if (appName === undefined) {
    throw new InternalException(SYSTEM.MISSING_APP_NAME, {
      details: { appName },
    })
  }
  if (!isSafePathSegment(appName)) {
    throw new InternalException(SYSTEM.INVALID_APP_NAME, {
      details: { appName },
    })
  }

  return join(homedir(), `.${appName}`)
}
