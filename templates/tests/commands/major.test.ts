import { expect, test } from 'vitest'
import { spawnCli } from '../utils/child'

test('major should print text', async () => {
  const data = await spawnCli()

  expect(data).toMatch(/Welcome to func-template/)
})

test('major should print JSON output', async () => {
  const data = await spawnCli(['--json', '--mode', 'prod', '--tag', 'cli'])

  expect(data).toMatch(/"mode": "prod"/)
  expect(data).toMatch(/"cli"/)
})
