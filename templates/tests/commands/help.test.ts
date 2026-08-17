import { expect, test } from 'vitest'
import { app } from '../utils/testing'

test('help flag should print registered commands', async () => {
  const result = await app.invoke(['--help'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toMatch(/Commands:/)
  expect(result.stdout).toMatch(/greet, g/)
  expect(result.stdout).toMatch(/--json/)
})

test('help flag should describe options for the selected command', async () => {
  const result = await app.invoke(['greet', '--help'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toMatch(/--name <string>/)
  expect(result.stdout).toMatch(/--upper/)
})
