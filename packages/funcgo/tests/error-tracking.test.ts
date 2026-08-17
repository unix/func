import { spawnSync } from 'child_process'
import path from 'path'
import { describe, expect, test } from 'vitest'
import { errorTrackingUrl, withErrorTrackingUrl } from '../src/utils/error-tracking'

describe('error tracking', () => {
  test('builds a tracking URL from a func system error code', () => {
    expect(errorTrackingUrl({ code: 'F_SYSTEM_DUPLICATE_COMMAND_TOKEN' })).toBe(
      'https://f.witt.im/DUPLICATE_COMMAND_TOKEN',
    )
  })

  test('reads system codes preserved by build plugins', () => {
    expect(
      errorTrackingUrl({
        code: 'PLUGIN_ERROR',
        pluginCode: 'F_SYSTEM_CANNOT_INFER_VALUE_TYPE',
      }),
    ).toBe('https://f.witt.im/CANNOT_INFER_VALUE_TYPE')
  })

  test('builds a tracking URL from a scaffold error code', () => {
    expect(errorTrackingUrl({ code: 'F_SCAFFOLD_ENTRY_NOT_FOUND' })).toBe(
      'https://f.witt.im/SCAFFOLD_ENTRY_NOT_FOUND',
    )
  })

  test('ignores unrelated and malformed codes', () => {
    expect(errorTrackingUrl(new Error('failed'))).toBeUndefined()
    expect(errorTrackingUrl({ code: 'F_RUNTIME_HANDLER_ERROR' })).toBeUndefined()
    expect(errorTrackingUrl({ code: 'F_SYSTEM_INVALID/TYPE' })).toBeUndefined()
  })

  test('places actionable error guidance at the bottom once', () => {
    const error = Object.assign(new Error('duplicate'), {
      code: 'F_SYSTEM_DUPLICATE_COMMAND_TOKEN',
    })
    const output = withErrorTrackingUrl('duplicate', error)

    expect(output).toBe(
      [
        'duplicate',
        '',
        'Learn how to fix this error: https://f.witt.im/DUPLICATE_COMMAND_TOKEN',
      ].join('\n'),
    )
    expect(withErrorTrackingUrl(output, error)).toBe(output)
  })

  test('reads system codes from aggregated build errors', () => {
    expect(
      errorTrackingUrl({
        errors: [
          {
            code: 'PLUGIN_ERROR',
            pluginCode: 'F_SYSTEM_CANNOT_INFER_VALUE_TYPE',
          },
        ],
      }),
    ).toBe('https://f.witt.im/CANNOT_INFER_VALUE_TYPE')
  })

  test('prints actionable guidance as the final dev error line', () => {
    const handler = path.resolve(
      process.cwd(),
      'src',
      'utils',
      'dev-error-handler.ts',
    )
    const script = [
      "const error = new Error('Duplicate handler')",
      "error.name = 'InternalException'",
      "error.code = 'F_SYSTEM_DUPLICATE_COMMAND_TOKEN'",
      'throw error',
    ].join(';')
    const result = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register', '-r', handler, '-e', script],
      { encoding: 'utf-8' },
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Duplicate handler')
    expect(result.stderr).toContain('F_SYSTEM_DUPLICATE_COMMAND_TOKEN')
    expect(result.stderr.trimEnd().split('\n').at(-1)).toBe(
      'Learn how to fix this error: https://f.witt.im/DUPLICATE_COMMAND_TOKEN',
    )
  })
})
