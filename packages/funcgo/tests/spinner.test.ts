import { stripVTControlCharacters } from 'node:util'
import { afterEach, describe, expect, test, vi } from 'vitest'
import * as spinner from '../src/utils/spinner'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('spinner', () => {
  test('prints build and watch states with readable spacing', () => {
    const writes: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
      writes.push(String(chunk))
      return true
    })

    spinner.start('Bundling...')
    spinner.succeed('Bundled in 120ms')
    spinner.info('Watching for changes...', 'Press Ctrl+C to stop')

    expect(stripVTControlCharacters(writes.join(''))).toBe(
      [
        '  ◇ Bundling...',
        '  ✓ Bundled in 120ms',
        '',
        '  ● Watching for changes...',
        '    Press Ctrl+C to stop',
        '',
      ].join('\n'),
    )
  })
})
