import { Command, Handler, Module, Stderr, Stdout } from '../src'
import type { Exception, OnDispose, OnError } from '../src'
import { HelpOption } from '../src/subpath/help'
import { JsonOutput, JsonOutputModule } from '../src/subpath/json-output'
import { createTestingApp } from '../src/subpath/testing'
import { Writable } from 'node:stream'
import { expect, run, test } from './_test'

test('should route explicit text and JSON responses without consuming return values', async () => {
  const outputUsage: boolean[] = []

  @Command('status')
  class StatusCommand {
    constructor(private readonly output: JsonOutput) {}

    @Handler()
    run(@Stdout() stdout: Writable) {
      stdout.write('Checking service status...\n')
      outputUsage.push(this.output.used)
      this.output.json({ ready: false })
      outputUsage.push(this.output.used)
      this.output.json({ ready: true })
      outputUsage.push(this.output.used)
      return { internal: 'result' }
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
    result: { internal: 'result' },
    stderr: '',
    stdout: 'Checking service status...\n',
  })
  expect(json).toMatchObject({
    error: undefined,
    result: { internal: 'result' },
    stderr: '',
    stdout: '{\n  "ready": true\n}\n',
  })
  expect(outputUsage).toEqual([false, false, false, false, true, true])
})

test('should not serialize discarded JSON responses in text mode', async () => {
  @Command('status')
  class StatusCommand {
    constructor(private readonly output: JsonOutput) {}

    @Handler()
    run(@Stdout() stdout: Writable) {
      stdout.write('ready\n')
      this.output.json(1n)
    }
  }

  @Module({ commands: [StatusCommand], imports: [JsonOutputModule] })
  class AppModule {}

  const result = await createTestingApp(AppModule).invoke(['status'])
  expect(result).toMatchObject({
    error: undefined,
    exitCode: 0,
    stderr: '',
    stdout: 'ready\n',
  })
})

test('should let onError replace a pending JSON response', async () => {
  @Command('fail')
  class FailCommand {
    constructor(private readonly output: JsonOutput) {}

    @Handler()
    run() {
      this.output.json({ ready: true })
      throw new Error('boom')
    }
  }

  @Module({ commands: [FailCommand] })
  class FailModule {}

  @Module({ imports: [JsonOutputModule, FailModule] })
  class AppModule implements OnError {
    constructor(private readonly output: JsonOutput) {}

    onError(exception: Exception) {
      this.output.json({ error: { message: exception.message } })
    }
  }

  const result = await createTestingApp(AppModule).invoke(['fail', '--json'])
  expect(result.error).toBeUndefined()
  expect(result.exitCode).toBe(1)
  expect(JSON.parse(result.stdout)).toEqual({
    error: { message: 'boom' },
  })
})

test('should make JSON output available to onError for invocation errors', async () => {
  @Module({ imports: [JsonOutputModule] })
  class AppModule implements OnError {
    constructor(private readonly output: JsonOutput) {}

    onError(exception: Exception) {
      this.output.json({ error: { message: exception.message } })
    }
  }

  const result = await createTestingApp(AppModule).invoke(['missing', '--json'])
  expect(result.error).toBeUndefined()
  expect(result.exitCode).toBe(1)
  expect(JSON.parse(result.stdout)).toEqual({
    error: { message: 'Unknown command "missing".' },
  })
})

test('should report invalid active JSON responses without partial output', async () => {
  @Command('status')
  class StatusCommand {
    constructor(private readonly output: JsonOutput) {}

    @Handler()
    run() {
      this.output.json(undefined)
    }
  }

  @Module({ commands: [StatusCommand], imports: [JsonOutputModule] })
  class AppModule {}

  const result = await createTestingApp(AppModule).invoke(['status', '--json'])
  expect(result).toMatchObject({
    error: undefined,
    exitCode: 1,
    stdout: '',
  })
  expect(result.stderr).toContain('JSON output requires a value.')
})

test('should preserve the standard stream model outside JSON mode', async () => {
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
    constructor(private readonly output: JsonOutput) {}

    @Handler()
    run(@Stdout() injectedStdout: Writable, @Stderr() injectedStderr: Writable) {
      streams.push({ stderr: injectedStderr, stdout: injectedStdout })
      this.output.json({ ready: true })
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

test('should not turn help return values into JSON implicitly', async () => {
  @Command({ description: 'show service status', path: 'status' })
  class StatusCommand {
    @Handler()
    run() {}
  }

  @Module({
    commands: [StatusCommand],
    imports: [JsonOutputModule],
    options: [HelpOption],
  })
  class AppModule {}

  const app = createTestingApp(AppModule)
  const text = await app.invoke(['status', '--help'])
  const json = await app.invoke(['status', '--help', '--json'])
  expect(text.stdout).toContain('Usage:')
  expect(json).toMatchObject({ error: undefined, stdout: '' })
})

test('should let onError replace JSON output when disposal fails', async () => {
  @Command('status')
  class StatusCommand {
    constructor(private readonly output: JsonOutput) {}

    @Handler()
    run() {
      this.output.json({ label: '\u001b[32mready\u001b[0m' })
    }
  }

  @Module({ commands: [StatusCommand], imports: [JsonOutputModule] })
  class AppModule implements OnDispose, OnError {
    constructor(private readonly output: JsonOutput) {}

    onDispose() {
      throw new Error('dispose failed')
    }

    onError(exception: Exception) {
      this.output.json({ error: { message: exception.message } })
    }
  }

  const result = await createTestingApp(AppModule).invoke(['status', '--json'])
  expect(result).toMatchObject({
    error: undefined,
    exitCode: 1,
    stderr: '',
  })
  expect(JSON.parse(result.stdout)).toEqual({
    error: { message: 'dispose failed' },
  })
})
