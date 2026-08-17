import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Writable } from 'node:stream'
import { afterEach } from 'vitest'
import { CommandMajor, Module, Handler } from '../src'
import { Logger, LogModule } from '../src/subpath/log'
import { bindLog } from '../src/subpath/log/runtime'
import {
  LOG_RUNTIME,
  LOG_SYSTEM,
  expect,
  logRuntimeErrorCode,
  logSystemErrorCode,
  random,
  run,
  test,
} from './_test'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach(directory => {
    rmSync(directory, { force: true, recursive: true })
  })
})

test.sequential('should inject a lazily initialized Logger', async () => {
  expect.assertions(1)

  @CommandMajor()
  class Major {
    constructor(private log: Logger) {}

    @Handler()
    run() {
      expect(this.log).toBeInstanceOf(Logger)
    }
  }

  @Module({
    imports: [LogModule.register()],
    commands: [Major],
  })
  class AppModule {}

  await run(AppModule, {
    appName: `func-log-test-${random()}`,
    argv: [],
  })
})

test('should require registration before use', () => {
  expect(() => new Logger().push('unregistered')).toThrow(
    expect.objectContaining({
      code: logRuntimeErrorCode(LOG_RUNTIME.NOT_REGISTERED),
    }),
  )
})

test('should lazily append formatted plain-text entries', () => {
  const output = captureOutput()
  const directory = temporaryDirectory()
  const log = boundLog(directory, output.stream)
  const filePath = log.path
  expect(existsSync(filePath)).toBe(false)
  log.push('hello %s', 'func', { enabled: true }, '\u001b[31mred\u001b[0m')
  expect(existsSync(filePath)).toBe(true)
  const content = readFileSync(filePath, 'utf8')
  expect(content).toMatch(/^\[\d{4}-\d{2}-\d{2}T.+Z\] hello func/)
  expect(content).toContain('enabled: true')
  expect(content).toContain('red')
  expect(content).not.toContain('\u001b[')
  expect(output.text()).toBe('')
  if (process.platform !== 'win32')
    expect(statSync(filePath).mode & 0o777).toBe(0o600)

  log.onDispose()
})

test('should report the log path to stderr after a failed invocation', () => {
  const output = captureOutput()
  const directory = temporaryDirectory()
  const log = boundLog(directory, output.stream, { exitCode: 1 })
  log.push('before failure')
  log.onDispose()
  expect(output.text()).toBe(`Logs were written to "${log.path}".\n`)
})

test('should not report the log path after a successful invocation', () => {
  const output = captureOutput()
  const log = boundLog(temporaryDirectory(), output.stream)
  log.push('completed')
  log.onDispose()
  expect(output.text()).toBe('')
})

test('should stop at maxBytes and warn only once', () => {
  const output = captureOutput()
  const log = boundLog(temporaryDirectory(), output.stream, { maxBytes: 1 })
  expect(() => log.push('too large')).not.toThrow()
  log.push('still too large')
  expect(existsSync(log.path)).toBe(false)
  expect(output.text()).toContain('reached the 1 byte limit')
  expect(output.text().match(/byte limit/g)).toHaveLength(1)
})

test('should allow maxFiles zero to disable file logging', () => {
  const output = captureOutput()
  const log = boundLog(temporaryDirectory(), output.stream, { maxFiles: 0 })
  log.push('disabled')
  log.onDispose()
  expect(existsSync(log.path)).toBe(false)
  expect(output.text()).toBe('')
})

test('should retain only the configured number of log files', () => {
  const output = captureOutput()
  const directory = temporaryDirectory()
  writeFileSync(join(directory, 'notes.txt'), 'keep')

  Array.from({ length: 3 }).forEach((_, index) => {
    const log = boundLog(directory, output.stream, { maxFiles: 2 })
    log.push('entry %d', index)
    log.onDispose()
  })

  const files = readdirSync(directory)
  expect(files.filter(file => file.endsWith('.log'))).toHaveLength(2)
  expect(files).toContain('notes.txt')
})

test('should disable logging and warn once when the file cannot be opened', () => {
  const output = captureOutput()
  const root = temporaryDirectory()
  const directory = join(root, 'logs')
  writeFileSync(directory, 'not a directory')
  const log = boundLog(directory, output.stream)
  expect(() => log.push('first')).not.toThrow()
  log.push('second')
  expect(output.text()).toContain('Cannot write log file')
  expect(output.text().match(/Cannot write log file/g)).toHaveLength(1)
})

test('should require an application name during initialization', async () => {
  @CommandMajor()
  class Major {
    constructor(_log: Logger) {}

    @Handler()
    run() {}
  }

  @Module({ commands: [Major], imports: [LogModule.register()] })
  class AppModule {}

  await expect(run(AppModule, { argv: [] })).rejects.toMatchObject({
    code: 'F_SYSTEM_MISSING_APP_NAME',
    message: 'F_SYSTEM_MISSING_APP_NAME',
  })
})

test('should validate the application name during initialization', async () => {
  @CommandMajor()
  class Major {
    constructor(_log: Logger) {}

    @Handler()
    run() {}
  }

  @Module({ commands: [Major], imports: [LogModule.register()] })
  class AppModule {}

  await expect(
    run(AppModule, { appName: '../unsafe', argv: [] }),
  ).rejects.toMatchObject({
    code: 'F_SYSTEM_INVALID_APP_NAME',
    message: 'F_SYSTEM_INVALID_APP_NAME',
  })
})

test('should reject invalid module options', () => {
  expect(() => LogModule.register({ maxBytes: 0 })).toThrow(
    expect.objectContaining({
      code: logSystemErrorCode(LOG_SYSTEM.DEFINITION),
    }),
  )
  expect(() => LogModule.register({ maxFiles: -1 })).toThrow(
    expect.objectContaining({
      code: logSystemErrorCode(LOG_SYSTEM.DEFINITION),
    }),
  )
})

const boundLog = (
  directoryPath: string,
  stderr: Writable,
  options: {
    exitCode?: number
    maxBytes?: number
    maxFiles?: number
  } = {},
): Logger =>
  bindLog(new Logger(), {
    directoryPath,
    exitCode: () => options.exitCode ?? 0,
    maxBytes: options.maxBytes ?? 1024 * 1024,
    maxFiles: options.maxFiles ?? 10,
    stderr,
  })

const temporaryDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'func-log-'))
  temporaryDirectories.push(directory)
  return directory
}

const captureOutput = () => {
  const chunks: Buffer[] = []
  const stream = new Writable({
    write(
      chunk: string | Uint8Array,
      _encoding: BufferEncoding,
      callback: (error?: Error | null) => void,
    ) {
      chunks.push(Buffer.from(chunk))
      callback()
    },
  })

  return {
    stream,
    text: () => Buffer.concat(chunks).toString('utf8'),
  }
}
