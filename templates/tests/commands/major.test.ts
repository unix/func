import { createTestingApp } from 'func/testing'
import { expect, test } from 'vitest'
import { AppModule } from '../../src/app.module'

const app = createTestingApp(AppModule)

test('major command should print the welcome message and GitHub URL', async () => {
  const result = await app.invoke()

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toBe(
    'Welcome to func!\nGitHub: https://github.com/unix/func\n',
  )
  expect(result.stderr).toBe('')
  expect(result.error).toBeUndefined()
})
