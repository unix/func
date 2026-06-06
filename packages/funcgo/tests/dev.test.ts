import { describe, expect, test } from 'vitest'
import { parseDevArgs } from '../src/actions/dev'
import {
  formatCannotInferValueTypeError,
  isCannotInferValueTypeError,
} from '../src/utils/dev-error-format'

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

describe('dev error formatting', () => {
  test('detects cannot infer value type errors by reason', () => {
    const error = {
      code: 'F_SYSTEM_INVALID_PARAM_TYPE',
      details: {
        property: 'name',
        reason: 'cannot-infer-value-type',
      },
    }

    expect(isCannotInferValueTypeError(error)).toBe(true)
  })

  test('detects cannot infer value type errors from older messages', () => {
    const error = {
      code: 'F_SYSTEM_INVALID_PARAM_TYPE',
      details: {
        property: 'name',
      },
      message: 'Cannot infer value type for "name". Please pass type explicitly.',
    }

    expect(isCannotInferValueTypeError(error)).toBe(true)
  })

  test('does not treat other invalid param type errors as type inference failures', () => {
    const error = {
      code: 'F_SYSTEM_INVALID_PARAM_TYPE',
      details: {
        property: 'verbose',
      },
      message: 'Field option "verbose" must decorate an instance property.',
    }

    expect(isCannotInferValueTypeError(error)).toBe(false)
  })

  test('formats explicit type guidance', () => {
    const error = {
      details: {
        property: 'name',
      },
    }

    expect(formatCannotInferValueTypeError(error)).toContain('@Value({ type: String })')
    expect(formatCannotInferValueTypeError(error)).toContain('name!: string')
  })
})
