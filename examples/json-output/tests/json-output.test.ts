import { createTestingApp } from 'func/testing'
import { expect, test } from 'vitest'
import { AppModule } from '../src/app.module'

const app = createTestingApp(AppModule)

test('commands should print their results to stdout', async () => {
  const overview = await app.invoke()
  const status = await app.invoke(['status'])
  const greet = await app.invoke(['greet', '--name', 'Codex'])

  expect(overview.stdout).toBe('Available commands: status, greet, users, fail\n')
  expect(status).toMatchObject({
    exitCode: 0,
    stderr: '',
  })
  expect(status.stdout).toBe('Checking service status...\n')
  expect(greet).toMatchObject({
    exitCode: 0,
    stderr: '',
    stdout: 'Hello, Codex!\n',
  })
})

test('--json should print only JSON content', async () => {
  const status = await app.invoke(['status', '--json'])
  const users = await app.invoke(['users', '--json'])

  expect(status).toMatchObject({
    exitCode: 0,
    stderr: '',
    stdout: '{\n  "service": "api",\n  "status": "ready"\n}\n',
  })
  expect(JSON.parse(status.stdout)).toEqual({
    service: 'api',
    status: 'ready',
  })
  expect(status.stdout).not.toContain('Checking service status...')
  expect(JSON.parse(users.stdout)).toEqual({
    users: [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Grace' },
    ],
  })
})

test('errors should respect text and JSON modes', async () => {
  const text = await app.invoke(['fail'])
  const json = await app.invoke(['fail', '--json'])

  expect(text).toMatchObject({
    exitCode: 1,
    stderr: 'The demo command failed.\n',
    stdout: '',
  })
  expect(json).toMatchObject({
    exitCode: 1,
    stderr: '',
  })
  expect(JSON.parse(json.stdout)).toMatchObject({
    error: {
      message: 'The demo command failed.',
    },
  })
})
