import { expect, test } from 'vitest'
import { app } from '../utils/testing'

test('greet command should print the default greeting', async () => {
  const result = await app.invoke(['greet'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toMatch(/Hello, friend!/)
})

test('greet command should support values, flags, and path handlers', async () => {
  const result = await app.invoke(['greet', 'shout', '--name', 'func', '--upper'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toMatch(/HELLO, FUNC!/)
})
