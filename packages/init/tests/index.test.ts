import { describe, expect, test } from 'vitest'
import { assertNoProjectNameArg, normalizeArgv } from '../src'

describe('normalizeArgv', () => {
  test('removes the script argument delimiter used by pnpm dev --', () => {
    expect(normalizeArgv(['node', 'src/bin.ts', '--', 'my-app'])).toEqual([
      'node',
      'src/bin.ts',
      'my-app',
    ])
  })

  test('keeps regular arguments unchanged', () => {
    expect(normalizeArgv(['node', 'src/bin.ts', 'my-app'])).toEqual([
      'node',
      'src/bin.ts',
      'my-app',
    ])
  })
})

describe('assertNoProjectNameArg', () => {
  test('rejects project names passed as positional arguments', () => {
    expect(() => assertNoProjectNameArg(['my-app'])).toThrow(
      'Project name is asked interactively',
    )
  })

  test('allows the interactive default path', () => {
    expect(() => assertNoProjectNameArg([])).not.toThrow()
  })
})
