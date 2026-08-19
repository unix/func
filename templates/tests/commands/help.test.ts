import { createTestingApp } from 'func/testing'
import { expect, test } from 'vitest'
import { AppModule } from '../../src/app.module'

const app = createTestingApp(AppModule)

test('help flag should print registered commands', async () => {
  const result = await app.invoke(['--help'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toMatch(/Commands:/)
  expect(result.stdout).toMatch(/deploy/)
  expect(result.stdout).toMatch(/greet/)
})

test('help flag should describe custom value decorators', async () => {
  const result = await app.invoke(['deploy', '--help'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toMatch(/--endpoint <string>/)
  expect(result.stdout).toMatch(/deployment endpoint/)
})
