import { describe, expect, test } from 'vitest'
import { resolveProjectName } from '../src'

describe('resolveProjectName', () => {
  test('uses a positional project name', () => {
    expect(resolveProjectName(['my-app'])).toBe('my-app')
  })

  test('uses the interactive default when no name is provided', () => {
    expect(resolveProjectName([])).toBeUndefined()
  })

  test('rejects multiple positional arguments', () => {
    expect(() => resolveProjectName(['my-app', 'extra'])).toThrow(
      'Only one project name',
    )
  })
})
