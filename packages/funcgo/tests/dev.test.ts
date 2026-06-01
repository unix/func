import { describe, expect, test } from 'vitest'
import { parseDevArgs } from '../src/actions/dev'

describe('parseDevArgs', () => {
  test('keeps user arguments after delimiter', () => {
    const args = parseDevArgs(['--file', 'src/index.ts', '--', 'hello', '--name', 'unix'])

    expect(args.file).toBe('src/index.ts')
    expect(args.userArgs).toEqual(['hello', '--name', 'unix'])
  })

  test('treats positional arguments as user arguments without delimiter', () => {
    const args = parseDevArgs(['hello', 'world'])

    expect(args.userArgs).toEqual(['hello', 'world'])
  })
})
