import { expect, test } from 'vitest'
import { main } from '../index'

test('prints pong for the ping command', () => {
  const output: string[] = []

  main(['ping'], message => output.push(message))

  expect(output).toEqual(['pong'])
})
