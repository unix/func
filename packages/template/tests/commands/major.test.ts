import { expect, test } from 'vitest'
import { spawnCli } from '../utils/child'

test('major should print text', async () => {
  const data = await spawnCli()

  expect(data).toMatch(/ok/)
})
