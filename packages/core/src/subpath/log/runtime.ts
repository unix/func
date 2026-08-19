import { RUNTIME } from '@func/contracts/log-errors'
import { randomUUID } from 'node:crypto'
import {
  closeSync,
  mkdirSync,
  openSync,
  readdirSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import { basename, join } from 'node:path'
import type { Writable } from 'node:stream'
import { formatWithOptions, stripVTControlCharacters } from 'node:util'
import type { OnDispose } from '../../di/lifecycle'
import { ErrorScope, InternalException } from '../../shared/errors'

export interface LogBinding {
  directoryPath: string
  exitCode: () => number
  maxBytes: number
  maxFiles: number
  stderr: Writable
}

interface LogState extends LogBinding {
  bytes: number
  disabled: boolean
  fileDescriptor?: number
  filePath: string
  hasEntries: boolean
  locationPrinted: boolean
  warningPrinted: boolean
}

const logStates = new WeakMap<Logger, LogState>()
const logFilePattern =
  /^func-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-\d+-[\da-f-]+\.log$/

export class Logger implements OnDispose {
  /** Resolved file path. The file is created by the first successful push. */
  get path(): string {
    return stateOrThrow(this).filePath
  }

  /** Appends one timestamped entry using Node.js console formatting semantics. */
  push(...data: unknown[]): void {
    const state = stateOrThrow(this)
    if (state.disabled) return

    const message = stripVTControlCharacters(
      formatWithOptions({ colors: false }, ...data),
    )
    const entry = Buffer.from(`[${new Date().toISOString()}] ${message}\n`, 'utf8')
    append(state, entry)
  }

  onDispose(): void {
    const state = logStates.get(this)
    if (!state) return
    close(state)
    state.disabled = true
    if (!state.hasEntries || state.exitCode() === 0 || state.locationPrinted) return
    state.locationPrinted = true
    writeWarning(state, `Logs were written to "${state.filePath}".\n`)
  }
}

export const bindLog = (instance: Logger, binding: LogBinding): Logger => {
  const fileName = `func-${fileTimestamp()}-${process.pid}-${randomUUID()}.log`
  logStates.set(instance, {
    ...binding,
    bytes: 0,
    disabled: binding.maxFiles === 0,
    filePath: join(binding.directoryPath, fileName),
    hasEntries: false,
    locationPrinted: false,
    warningPrinted: false,
  })
  return instance
}

const append = (state: LogState, entry: Buffer) => {
  if (entry.byteLength > state.maxBytes - state.bytes) {
    state.disabled = true
    warnOnce(
      state,
      `Log file "${state.filePath}" reached the ${state.maxBytes} byte limit. Further entries will not be written.`,
    )
    return
  }

  const fileDescriptor = open(state)
  if (fileDescriptor === undefined) return

  try {
    writeAll(fileDescriptor, entry)
    state.bytes += entry.byteLength
    state.hasEntries = true
  } catch (error) {
    disable(state, error)
  }
}

const open = (state: LogState): number | undefined => {
  if (state.fileDescriptor !== undefined) return state.fileDescriptor

  try {
    mkdirSync(state.directoryPath, { mode: 0o700, recursive: true })
    state.fileDescriptor = openSync(state.filePath, 'ax', 0o600)
    cleanup(state)
    return state.fileDescriptor
  } catch (error) {
    disable(state, error)
    return undefined
  }
}

const close = (state: LogState) => {
  const fileDescriptor = state.fileDescriptor
  if (fileDescriptor === undefined) return
  state.fileDescriptor = undefined

  try {
    closeSync(fileDescriptor)
  } catch (error) {
    warnOnce(state, `Cannot close log file "${state.filePath}": ${reason(error)}`)
  }
}

const disable = (state: LogState, error: unknown) => {
  state.disabled = true
  close(state)
  warnOnce(state, `Cannot write log file "${state.filePath}": ${reason(error)}`)
}

const cleanup = (state: LogState) => {
  try {
    const currentName = basename(state.filePath)
    const previousFiles = readdirSync(state.directoryPath, {
      withFileTypes: true,
    })
      .filter(file => file.isFile() && logFilePattern.test(file.name))
      .map(file => file.name)
      .filter(file => file !== currentName)
      .sort((a, b) => a.localeCompare(b, 'en'))
    const allowedPreviousFiles = state.maxFiles - 1
    const removeCount = previousFiles.length - allowedPreviousFiles
    if (removeCount <= 0) return

    previousFiles.slice(0, removeCount).forEach(file => {
      try {
        unlinkSync(join(state.directoryPath, file))
      } catch {
        // Log retention is best effort and must not affect the command.
      }
    })
  } catch {
    // Log retention is best effort and must not affect the command.
  }
}

const writeAll = (fileDescriptor: number, value: Buffer) => {
  let offset = 0
  while (offset < value.byteLength) {
    offset += writeSync(fileDescriptor, value, offset, value.byteLength - offset)
  }
}

const warnOnce = (state: LogState, message: string) => {
  if (state.warningPrinted) return
  state.warningPrinted = true
  writeWarning(state, `${message}\n`)
}

const writeWarning = (state: LogState, message: string) => {
  try {
    state.stderr.write(message)
  } catch {
    // A logging failure must not replace the command's original result.
  }
}

const stateOrThrow = (instance: Logger): LogState => {
  const state = logStates.get(instance)
  if (state) return state
  throw new InternalException(RUNTIME.NOT_REGISTERED, {
    message: 'Logger must be registered through LogModule.register() before use.',
    scope: ErrorScope.RUNTIME,
  })
}

const fileTimestamp = (): string =>
  new Date().toISOString().replaceAll(':', '-').replace('.', '-')

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
