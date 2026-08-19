import { createTestingApp } from 'func/testing'
import { expect, test } from 'vitest'
import { AppModule } from '../../src/app.module'

const app = createTestingApp(AppModule)

test('runtime errors should be printed to stderr', async () => {
  const result = await app.invoke(['unknown'])

  expect(result.exitCode).toBe(1)
  expect(result.stderr).toMatch(/Unknown command "unknown"\./)
})
