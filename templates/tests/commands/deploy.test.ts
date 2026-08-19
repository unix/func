import { createTestingApp } from 'func/testing'
import { expect, test } from 'vitest'
import { AppModule } from '../../src/app.module'

const app = createTestingApp(AppModule)

test('deploy command should accept an HTTP URL', async () => {
  const result = await app.invoke([
    'deploy',
    '--endpoint',
    'https://example.com/releases',
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toBe('Deploying to https://example.com\n')
})

test('deploy command should reject an invalid URL', async () => {
  const result = await app.invoke(['deploy', '--endpoint', 'example'])

  expect(result.exitCode).toBe(1)
  expect(result.stderr).toMatch(/Expected a valid absolute URL\./)
})
