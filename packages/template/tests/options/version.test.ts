import { expect, test } from 'vitest'
import pkg from '../../package.json'
import { spawnCli } from '../utils/child'

test('option version should print version', async () => {
  const data = await spawnCli(['--version'])

  expect(data).toMatch(new RegExp(pkg.version))
})
