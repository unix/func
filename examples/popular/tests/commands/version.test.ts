import { expect, test } from 'vitest'
import pkg from '../../package.json'
import { spawnCli } from '../utils/child'

test('version flag should print version', async () => {
  const data = await spawnCli(['--version'])

  expect(data).toMatch(new RegExp(pkg.version))
})
