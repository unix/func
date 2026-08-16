import { expect, test } from 'vitest'
import { spawnCli } from '../utils/child'

test('completion mode should reuse registered command metadata', async () => {
  const data = await spawnCli(['gr'], {
    env: { ...process.env, _FUNC_TEMPLATE_COMPLETE: 'bash_complete' },
  })

  expect(data).toMatch(/greet/)
})
