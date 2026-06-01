import { expect, test } from 'vitest'
import { spawnCli } from '../utils/child'

test('command hello should print hello', async () => {
  const data = await spawnCli(['hello'])

  expect(data).toMatch(/hello/)
})
