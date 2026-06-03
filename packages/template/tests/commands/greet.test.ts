import { expect, test } from 'vitest'
import { spawnCli } from '../utils/child'

test('greet command should print the default greeting', async () => {
  const data = await spawnCli(['greet'])

  expect(data).toMatch(/Hello, friend!/)
})

test('greet command should support values, flags, and path handlers', async () => {
  const data = await spawnCli(['greet', 'shout', '--name', 'func', '--upper'])

  expect(data).toMatch(/HELLO, FUNC!/)
})
