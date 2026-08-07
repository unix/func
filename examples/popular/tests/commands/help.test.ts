import { expect, test } from 'vitest'
import { spawnCli } from '../utils/child'

test('help flag should print registered commands', async () => {
  const data = await spawnCli(['--help'])

  expect(data).toMatch(/Commands:/)
  expect(data).toMatch(/greet, g/)
})
