import {
  Catch,
  Command,
  Handler,
  MODULE_FILTER,
  Module,
  Stderr,
  Stdout,
} from '../src'
import type { Exception, ExceptionFilter, OnDispose } from '../src'
import { HelpOption } from '../src/subpath/help'
import { JsonOutputModule } from '../src/subpath/json-output'
import { createTestingApp } from '../src/subpath/testing'
import { Writable } from 'node:stream'
import { SYSTEM, expect, invokeUnchecked, run, systemErrorCode, test } from './_test'

test('should reject invalid module options with a documented error code', () => {
  expect(() => invokeUnchecked(JsonOutputModule.register, null)).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_JSON_OUTPUT_MODULE_OPTIONS),
      message: systemErrorCode(SYSTEM.INVALID_JSON_OUTPUT_MODULE_OPTIONS),
    }),
  )
  expect(() =>
    invokeUnchecked(JsonOutputModule.register, { suppressStdout: 'yes' }),
  ).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_JSON_OUTPUT_MODULE_OPTIONS),
      message: systemErrorCode(SYSTEM.INVALID_JSON_OUTPUT_MODULE_OPTIONS),
    }),
  )
})

test('should render module return values as text and JSON', async () => {
  @Command('status')
  class StatusCommand {
    @Handler()
    run() {
      return { label: '\u001b[32mready\u001b[0m', ready: true }
    }
  }

  @Module({
    commands: [StatusCommand],
    imports: [JsonOutputModule],
  })
  class AppModule {}

  const app = createTestingApp(AppModule)
  const text = await app.invoke(['status'])
  const json = await app.invoke(['status', '--json'])
  expect(text).toMatchObject({
    error: undefined,
    result: { label: '\u001b[32mready\u001b[0m', ready: true },
    stdout: '{\n  "label": "\\u001b[32mready\\u001b[0m",\n  "ready": true\n}\n',
  })
  expect(json).toMatchObject({
    error: undefined,
    result: { label: '\u001b[32mready\u001b[0m', ready: true },
    stdout: '{\n  "label": "ready",\n  "ready": true\n}\n',
  })
})

test('should apply a root JSON module to feature commands', async () => {
  @Command('status')
  class StatusCommand {
    @Handler()
    run(@Stdout() stdout: Writable, @Stderr() stderr: Writable) {
      stdout.write('human output\n')
      stderr.write('warning\n')
      return { ready: true }
    }
  }

  @Module({ commands: [StatusCommand] })
  class StatusModule {}

  @Module({ imports: [JsonOutputModule, StatusModule] })
  class AppModule {}

  const app = createTestingApp(AppModule)
  const text = await app.invoke(['status'])
  const json = await app.invoke(['status', '--json'])
  expect(text).toMatchObject({
    error: undefined,
    stderr: 'warning\n',
    stdout: 'human output\n{\n  "ready": true\n}\n',
  })
  expect(json).toMatchObject({
    error: undefined,
    stderr: 'warning\n',
    stdout: '{\n  "ready": true\n}\n',
  })
})

test('should manage stdout only while JSON suppression is enabled', async () => {
  const stdout = new Writable({
    write(_chunk, _encoding, callback) {
      callback()
    },
  })
  const stderr = new Writable({
    write(_chunk, _encoding, callback) {
      callback()
    },
  })
  const streams: { stderr: Writable; stdout: Writable }[] = []

  @Command('status')
  class StatusCommand {
    @Handler()
    run(@Stdout() injectedStdout: Writable, @Stderr() injectedStderr: Writable) {
      streams.push({ stderr: injectedStderr, stdout: injectedStdout })
      return true
    }
  }

  @Module({ commands: [StatusCommand], imports: [JsonOutputModule] })
  class AppModule {}

  await run(AppModule, { argv: ['status'], stderr, stdout })
  await run(AppModule, { argv: ['status', '--json'], stderr, stdout })
  expect(streams[0]).toEqual({ stderr, stdout })
  expect(streams[1]?.stderr).toBe(stderr)
  expect(streams[1]?.stdout).not.toBe(stdout)
})

test('should allow JSON mode to preserve stdout explicitly', async () => {
  const chunks: Buffer[] = []
  const stdout = new Writable({
    write(chunk: string | Uint8Array, _encoding, callback) {
      chunks.push(Buffer.from(chunk))
      callback()
    },
  })
  let injectedStdout: Writable | undefined

  @Command('status')
  class StatusCommand {
    @Handler()
    run(@Stdout() injected: Writable) {
      injectedStdout = injected
      injected.write('human output\n')
      return true
    }
  }

  @Module({
    commands: [StatusCommand],
    imports: [JsonOutputModule.register({ suppressStdout: false })],
  })
  class AppModule {}

  const result = await run(AppModule, {
    argv: ['status', '--json'],
    stdout,
  })
  expect(result.result).toBe(true)
  expect(injectedStdout).toBe(stdout)
  expect(Buffer.concat(chunks).toString('utf8')).toBe('human output\ntrue\n')
})

test('should prefer a feature JSON module over the root module', async () => {
  @Command('status')
  class StatusCommand {
    @Handler()
    run(@Stdout() stdout: Writable) {
      stdout.write('feature output\n')
      return true
    }
  }

  @Module({
    commands: [StatusCommand],
    imports: [JsonOutputModule.register({ suppressStdout: false })],
  })
  class StatusModule {}

  @Module({ imports: [JsonOutputModule, StatusModule] })
  class AppModule {}

  const result = await createTestingApp(AppModule).invoke(['status', '--json'])
  expect(result).toMatchObject({
    error: undefined,
    stdout: 'feature output\ntrue\n',
  })
})

test('should serialize filter return values without built-in error JSON logic', async () => {
  @Catch()
  class ErrorResultFilter implements ExceptionFilter {
    catch(error: Exception) {
      return { error: { code: error.code, message: error.message } }
    }
  }

  @Command('fail')
  class FailCommand {
    @Handler()
    run() {
      throw new Error('boom')
    }
  }

  @Module({
    commands: [FailCommand],
    imports: [JsonOutputModule],
    providers: [
      {
        provide: MODULE_FILTER,
        useClass: ErrorResultFilter,
      },
    ],
  })
  class AppModule {}

  const result = await createTestingApp(AppModule).invoke(['fail', '--json'])
  expect(result.error).toBeUndefined()
  expect(result.exitCode).toBe(1)
  expect(JSON.parse(result.stdout)).toMatchObject({
    error: { message: 'boom' },
  })
})

test('should serialize app filter results for invocation errors', async () => {
  @Catch()
  class ErrorResultFilter implements ExceptionFilter {
    catch(error: Exception) {
      return { error: { code: error.code, message: error.message } }
    }
  }

  @Module({
    imports: [JsonOutputModule],
    providers: [
      {
        provide: MODULE_FILTER,
        useClass: ErrorResultFilter,
      },
    ],
  })
  class AppModule {}

  const result = await createTestingApp(AppModule).invoke(['missing', '--json'])
  expect(result.error).toBeUndefined()
  expect(result.exitCode).toBe(1)
  expect(JSON.parse(result.stdout)).toMatchObject({
    error: { message: 'Unknown command "missing".' },
  })
  expect(result.stderr).toBe('')
})

test('should combine module JSON output with help actions', async () => {
  @Command({ description: 'list users', path: 'users' })
  class UsersCommand {
    @Handler()
    run() {
      return []
    }
  }

  @Module({
    commands: [UsersCommand],
    imports: [JsonOutputModule],
  })
  class UsersModule {}

  @Module({
    imports: [UsersModule],
    options: [HelpOption],
  })
  class AppModule {}

  const app = createTestingApp(AppModule)
  const text = await app.invoke(['users', '--help'])
  const json = await app.invoke(['users', '--help', '--json'])
  expect(text.error).toBeUndefined()
  expect(text.stdout).toContain('Usage:')
  expect(json.error).toBeUndefined()
  expect(JSON.parse(json.stdout)).toMatchObject({
    description: 'list users',
    path: ['users'],
    title: 'users',
  })
  expect(json.stdout).not.toContain('Usage:')
})

test('should report undefined JSON results without partial output', async () => {
  @Command('status')
  class StatusCommand {
    @Handler()
    run() {}
  }

  @Module({
    commands: [StatusCommand],
    imports: [JsonOutputModule],
  })
  class AppModule {}

  const result = await createTestingApp(AppModule).invoke(['status', '--json'])
  expect(result).toMatchObject({
    error: undefined,
    exitCode: 1,
    stdout: '',
  })
  expect(result.stderr).toContain(
    'JSON output requires the selected handler to return a value.',
  )
})

test('should preserve settled JSON when disposal fails', async () => {
  @Command('status')
  class StatusCommand {
    @Handler()
    run() {
      return { ready: true }
    }
  }

  @Module({
    commands: [StatusCommand],
    imports: [JsonOutputModule],
  })
  class AppModule implements OnDispose {
    onDispose() {
      throw new Error('dispose failed')
    }
  }

  const result = await createTestingApp(AppModule).invoke(['status', '--json'])
  expect(result).toMatchObject({
    error: undefined,
    exitCode: 0,
    stderr: 'Lifecycle hook module "AppModule".onDispose() failed: dispose failed\n',
    stdout: '{\n  "ready": true\n}\n',
  })
})
