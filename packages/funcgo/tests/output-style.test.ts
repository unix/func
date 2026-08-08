import { PassThrough } from 'node:stream'
import { stripVTControlCharacters, styleText } from 'node:util'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { main } from '../src'
import { style } from '../src/utils/style'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('output styles', () => {
  test('maps semantic styles to util.styleText formats', () => {
    const stream = new PassThrough()
    Object.defineProperty(stream, 'isTTY', { value: true })

    expect(style.accent('accent', stream)).toBe(
      styleText('cyan', 'accent', { stream }),
    )
    expect(style.dim('detail', stream)).toBe(styleText('dim', 'detail', { stream }))
    expect(style.error('error', stream)).toBe(
      styleText(['red', 'bold'], 'error', { stream }),
    )
    expect(style.success('success', stream)).toBe(
      styleText(['green', 'bold'], 'success', { stream }),
    )
    expect(style.warning('warning', stream)).toBe(
      styleText('yellow', 'warning', { stream }),
    )
  })

  test('keeps help readable when terminal styles are removed', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await main(['node', 'funcgo', '--help'])

    const output = stripVTControlCharacters(
      log.mock.calls.map(([value]) => String(value)).join('\n'),
    )
    expect(output).toContain('FUNCGO')
    expect(output).toContain('  dev <command> --  run project entry')
    expect(output).toContain('  --help -h <option> --  help')
  })

  test('keeps version output unstyled for scripts', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await main(['node', 'funcgo', '--version'])
    const output = log.mock.calls.map(([value]) => String(value)).join('\n')
    expect(output).toMatch(/^\d+\.\d+\.\d+/)
    expect(stripVTControlCharacters(output)).toBe(output)
  })
})
