import { expect, test } from 'vitest'
import { spawnCli } from '../utils/child'

test('help flag should print registered commands', async () => {
  const data = await spawnCli(['--help'])
  expect(data).toMatch(/Commands:/)
  expect(data).toMatch(/greet, g/)
})

test('help flag should describe options for the selected command', async () => {
  const data = await spawnCli(['greet', '--help'])
  expect(data).toMatch(/--name <string>/)
  expect(data).toMatch(/--upper/)
})
