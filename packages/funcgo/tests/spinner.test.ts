import { stripVTControlCharacters } from 'node:util'
import { afterEach, describe, expect, test, vi } from 'vitest'
import * as spinner from '../src/utils/spinner'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('spinner', () => {
  test('prints build and watch states with readable spacing', () => {
    const writes: string[] = []
    const capture = (chunk: unknown): true => {
      writes.push(String(chunk))
      return true
    }
    vi.spyOn(process.stdout, 'write').mockImplementation(capture)
    vi.spyOn(process.stderr, 'write').mockImplementation(capture)
    spinner.start('Bundling...')
    spinner.succeed('Bundled in 120ms')
    spinner.warning('Node.js 20 is end-of-life.')
    spinner.info('Watching for changes...', 'Press Ctrl+C to stop')

    expect(stripVTControlCharacters(writes.join(''))).toBe(
      [
        '  ◇ Bundling...',
        '  ✓ Bundled in 120ms',
        '  ▲ Node.js 20 is end-of-life.',
        '',
        '  ● Watching for changes...',
        '    Press Ctrl+C to stop',
        '',
      ].join('\n'),
    )
  })
})
