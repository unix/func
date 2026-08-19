import { describe, expect, test } from 'vitest'
import { devErrorMessage } from '../src/utils/dev-error-message'
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
    const error = Object.assign(new Error('Duplicate handler'), {
      code: 'F_SYSTEM_DUPLICATE_COMMAND_TOKEN',
    })
    const message = devErrorMessage(error, { debug: false })
    expect(message).toContain('Duplicate handler')
    expect(message).toContain('F_SYSTEM_DUPLICATE_COMMAND_TOKEN')
    expect(message?.trimEnd().split('\n').at(-1)).toBe(
      'Learn how to fix this error: https://f.witt.im/DUPLICATE_COMMAND_TOKEN',
    )
  })
})
