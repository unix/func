import { expect, test } from 'vitest'
import { cli } from '../utils/cli'

test('completion mode should reuse registered command metadata', async () => {
  const result = await cli.run(['gr'], {
    env: { ...process.env, _FUNC_TEMPLATE_COMPLETE: 'bash_complete' },
  })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toMatch(/greet/)
})
