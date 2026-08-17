import { expect, test } from 'vitest'
import { app } from '../utils/testing'

test('major should print text', async () => {
  const result = await app.invoke()

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toMatch(/Welcome to func-template/)
})

test('major should print JSON output', async () => {
  const result = await app.invoke(['--json', '--mode=prod', '--tag=cli'])

  expect(result.stderr).toBe('')
  expect(result.exitCode).toBe(0)
  expect(result.stdout).toMatch(/"mode": "prod"/)
  expect(result.stdout).toMatch(/"cli"/)
})
