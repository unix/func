import { expect, test } from 'vitest'
import pkg from '../../package.json'
import { app } from '../utils/testing'

test('version flag should print version', async () => {
  const result = await app.invoke(['--version'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toMatch(new RegExp(pkg.version))
})
