import { SYSTEM } from '@func/contracts/log-errors'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ModuleMetadata } from '../../application/definition'
import { Context } from '../../runtime/context'
import { InternalException } from '../../shared/errors'
import { isSafePathSegment } from '../../shared/path-segment'
import type { LogModuleOptions } from './interfaces'
import { Logger, bindLog } from './runtime'

const defaultMaxBytes = 10 * 1024 * 1024
const defaultMaxFiles = 10

export class LogModule {
  // Nest-style dynamic module APIs conventionally use register().
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static register(options: LogModuleOptions): ModuleMetadata {
    assertOptions(options)
    const directoryPath = join(homedir(), `.${options.appName}`, 'logs')
    const maxBytes = options.maxBytes ?? defaultMaxBytes
    const maxFiles = options.maxFiles ?? defaultMaxFiles

    return {
      providers: [
        {
          provide: Logger,
          inject: [Context],
          useFactory: (context: Context) =>
            bindLog(new Logger(), {
              directoryPath,
              exitCode: () => context.exitCode,
              maxBytes,
              maxFiles,
              stderr: context.io.stderr,
            }),
        },
      ],
      exports: [Logger],
    }
  }
}

const assertOptions = (options: unknown) => {
  if (!options || typeof options !== 'object') {
    throw new InternalException(
      SYSTEM.DEFINITION,
      'LogModule.register() requires an options object.',
    )
  }

  const appName = 'appName' in options ? options.appName : undefined
  assertSafeSegment(appName)
  assertPositiveIntegerOption(options, 'maxBytes')
  assertNonNegativeIntegerOption(options, 'maxFiles')
}

const assertSafeSegment = (value: unknown) => {
  if (isSafePathSegment(value)) return
  throw new InternalException(SYSTEM.DEFINITION, {
    details: { value },
    message: 'Log appName must be a safe path segment.',
  })
}

const assertPositiveIntegerOption = (options: object, key: 'maxBytes') => {
  if (!(key in options) || options[key] === undefined) return
  const value = options[key]
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return

  throw new InternalException(SYSTEM.DEFINITION, {
    details: { [key]: value },
    message: `LogModule.register() ${key} must be a positive integer.`,
  })
}

const assertNonNegativeIntegerOption = (options: object, key: 'maxFiles') => {
  if (!(key in options) || options[key] === undefined) return
  const value = options[key]
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return

  throw new InternalException(SYSTEM.DEFINITION, {
    details: { [key]: value },
    message: `LogModule.register() ${key} must be a non-negative integer.`,
  })
}
