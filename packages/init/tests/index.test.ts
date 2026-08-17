import { SCAFFOLD, formatScaffoldErrorCode } from '@func/contracts/scaffold-errors'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { main, resolveProjectName } from '../src'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolveProjectName', () => {
  test('uses a positional project name', () => {
    expect(resolveProjectName(['my-app'])).toBe('my-app')
  })

  test('uses the interactive default when no name is provided', () => {
    expect(resolveProjectName([])).toBeUndefined()
  })

  test('rejects multiple positional arguments', () => {
    expect(() => resolveProjectName(['my-app', 'extra'])).toThrow(
      expect.objectContaining({
        code: formatScaffoldErrorCode(SCAFFOLD.MULTIPLE_PROJECT_NAMES),
      }),
    )
  })
})

describe('create-func options', () => {
  test('prints help without creating a project', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await main(['node', 'create-func', '--help'])
    expect(log).toHaveBeenCalledOnce()
    expect(String(log.mock.calls[0]?.[0])).toContain(
      'Usage: create-func [options] [project-name]',
    )
    expect(String(log.mock.calls[0]?.[0])).toContain('npm init func@latest my-app')
    expect(String(log.mock.calls[0]?.[0])).not.toContain('command')
  })

  test('prints the package version', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await main(['node', 'create-func', '-v'])
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\d+\.\d+\.\d+/))
  })

  test('rejects unknown options', async () => {
    await expect(main(['node', 'create-func', '--unknown'])).rejects.toThrow(
      'Unknown option: --unknown.',
    )
  })
})
