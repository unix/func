import { RUNTIME } from '@func/contracts/config-errors'
import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'
import { ErrorScope, InternalException, isException } from '../../shared/errors'
import { isConfigRecord } from './schema'
import type { ConfigRecord } from './schema'

export interface ConfigBinding {
  filePath: string
  maxBytes?: number
}

export const configFileExists = (binding: ConfigBinding): boolean =>
  existsSync(binding.filePath)

export const readConfigFile = (binding: ConfigBinding): ConfigRecord => {
  let content: Buffer
  try {
    const size = statSync(binding.filePath).size
    assertMaxBytes(binding, size)
    content = readFileSync(binding.filePath)
    assertMaxBytes(binding, content.byteLength)
  } catch (error) {
    if (isException(error)) throw error
    throw new InternalException(RUNTIME.FILE_READ, {
      cause: nativeError(error),
      details: { path: binding.filePath },
      message: `Cannot read config file "${binding.filePath}".`,
      scope: ErrorScope.RUNTIME,
    })
  }

  try {
    // JSON.parse is typed as any; treat file content as unknown until checked.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const value = JSON.parse(content.toString('utf8')) as unknown
    if (!isConfigRecord(value)) throw new TypeError('Expected a JSON object.')
    return value
  } catch (error) {
    throw new InternalException(RUNTIME.FILE_PARSE, {
      cause: nativeError(error),
      details: { path: binding.filePath },
      message: `Cannot parse config file "${binding.filePath}" as a JSON object.`,
      scope: ErrorScope.RUNTIME,
    })
  }
}

export const writeConfigFile = (
  binding: ConfigBinding,
  data: ConfigRecord,
): void => {
  let encoded: string
  try {
    encoded = `${JSON.stringify(data, null, 2)}\n`
  } catch (error) {
    throw new InternalException(RUNTIME.FILE_WRITE, {
      cause: nativeError(error),
      details: { path: binding.filePath },
      message: `Cannot write config file "${binding.filePath}".`,
      scope: ErrorScope.RUNTIME,
    })
  }
  assertMaxBytes(binding, Buffer.byteLength(encoded, 'utf8'))
  const directory = dirname(binding.filePath)
  const temporaryPath = `${binding.filePath}.${process.pid}.${randomUUID()}.tmp`
  try {
    mkdirSync(directory, { mode: 0o700, recursive: true })
    writeFileSync(temporaryPath, encoded, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
    renameSync(temporaryPath, binding.filePath)
  } catch (error) {
    removeTemporaryFile(temporaryPath)
    throw new InternalException(RUNTIME.FILE_WRITE, {
      cause: nativeError(error),
      details: { path: binding.filePath },
      message: `Cannot write config file "${binding.filePath}".`,
      scope: ErrorScope.RUNTIME,
    })
  }
}

const assertMaxBytes = (binding: ConfigBinding, size: number) => {
  if (binding.maxBytes === undefined || size <= binding.maxBytes) return
  throw new InternalException(RUNTIME.FILE_TOO_LARGE, {
    details: { maxBytes: binding.maxBytes, path: binding.filePath, size },
    message: `Config file "${binding.filePath}" is ${size} bytes and exceeds the ${binding.maxBytes} byte limit.`,
    scope: ErrorScope.RUNTIME,
  })
}

const removeTemporaryFile = (filePath: string) => {
  try {
    unlinkSync(filePath)
  } catch {
    // Temporary-file cleanup must preserve the original write failure.
  }
}

const nativeError = (error: unknown): Error | undefined =>
  error instanceof Error ? error : undefined
