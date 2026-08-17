import { createTestingApp } from 'func/testing'
import { expect, test } from 'vitest'
import { AppModule } from '../../src/app.module'

const app = createTestingApp(AppModule)

test('major should print text', async () => {
  const result = await app.invoke()

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toBe('Welcome to popular\n')
  expect(result.stderr).toBe('')
  expect(result.error).toBeUndefined()
})
