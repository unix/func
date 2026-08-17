import { SYSTEM } from '@func/contracts/log-errors'
import { join } from 'node:path'
import type { ModuleMetadata } from '../../application/definition'
import { Context } from '../../runtime/context'
import { InternalException } from '../../shared/errors'
import { applicationDirectory } from '../sub-shared/application-directory'
import { initializeApplicationResource } from '../sub-shared/application-resource'
import type { LogModuleOptions } from './interfaces'
import { Logger, bindLog } from './runtime'

const defaultMaxBytes = 10 * 1024 * 1024
const defaultMaxFiles = 10

export class LogModule {
  // Nest-style dynamic module APIs conventionally use register().
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static register(options: LogModuleOptions = {}): ModuleMetadata {
    assertOptions(options)
    const maxBytes = options.maxBytes ?? defaultMaxBytes
    const maxFiles = options.maxFiles ?? defaultMaxFiles

    return {
      providers: [
        {
          provide: Logger,
          inject: [Context],
          useFactory: (context: Context) =>
            initializeLogger(context, maxBytes, maxFiles),
        },
      ],
      exports: [Logger],
    }
  }
}

const initializeLogger = (
  context: Context,
  maxBytes: number,
  maxFiles: number,
): Logger => {
  const directoryPath = logDirectory(context.appName)
  initializeApplicationResource(context, {
    duplicateError: () => duplicateDirectoryError(context.appName, directoryPath),
    key: `log-directory:${directoryPath}`,
  })
  return bindLog(new Logger(), {
    directoryPath,
    exitCode: () => context.exitCode,
    maxBytes,
    maxFiles,
    stderr: context.io.stderr,
  })
}

const assertOptions = (options: unknown) => {
  if (!options || typeof options !== 'object') {
    throw new InternalException(SYSTEM.DEFINITION, {
      details: { reason: 'invalid-log-module-options' },
    })
  }

  assertPositiveIntegerOption(options, 'maxBytes')
  assertNonNegativeIntegerOption(options, 'maxFiles')
}

const logDirectory = (appName?: string): string =>
  join(applicationDirectory(appName), 'logs')

const duplicateDirectoryError = (appName: string | undefined, directory: string) => {
  return new InternalException(SYSTEM.DEFINITION, {
    details: { appName, directory, reason: 'duplicate-log-directory' },
  })
}

const assertPositiveIntegerOption = (options: object, key: 'maxBytes') => {
  if (!(key in options) || options[key] === undefined) return
  const value = options[key]
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return

  throw new InternalException(SYSTEM.DEFINITION, {
    details: { key, reason: 'invalid-positive-integer', value },
  })
}

const assertNonNegativeIntegerOption = (options: object, key: 'maxFiles') => {
  if (!(key in options) || options[key] === undefined) return
  const value = options[key]
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return

  throw new InternalException(SYSTEM.DEFINITION, {
    details: { key, reason: 'invalid-non-negative-integer', value },
  })
}
