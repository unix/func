import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, expect, test } from 'vitest'
import { parseDevArgs } from '../src/actions/dev'
import {
  formatCannotInferValueTypeError,
  isCannotInferValueTypeError,
} from '../src/utils/dev-error-format'

describe('parseDevArgs', () => {
  test('keeps user arguments after delimiter', () => {
    const args = parseDevArgs([
      '--file',
      'src/index.ts',
      '--',
      'hello',
      '--name',
      'unix',
    ])

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
      code: 'F_SYSTEM_CANNOT_INFER_VALUE_TYPE',
      details: {
        property: 'name',
        reason: 'cannot-infer-value-type',
      },
    }

    expect(isCannotInferValueTypeError(error)).toBe(true)
  })

  test('keeps recognizing the legacy invalid param type code', () => {
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

    expect(formatCannotInferValueTypeError(error)).toContain(
      '@Value({ type: String })',
    )
    expect(formatCannotInferValueTypeError(error)).toContain('name!: string')
  })

  test('formats the command class and project source location', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'funcgo-dev-error-'))

    try {
      const sourceFile = path.join(tempDir, 'src', 'commands', 'greet.command.ts')
      fs.mkdirSync(path.dirname(sourceFile), { recursive: true })
      fs.writeFileSync(
        sourceFile,
        [
          "import { Value } from 'func'",
          '',
          'class Greet {',
          '  @Value()',
          "  name = 'friend'",
          '}',
        ].join('\n'),
      )
      const error = {
        details: {
          className: 'Greet',
          property: 'name',
        },
        stack: [
          'FuncError: Cannot infer value type for "name".',
          `    at __decorate (${sourceFile}:1:1)`,
          `    at Object.<anonymous> (${sourceFile}:5:3)`,
          `    at createSystemError (${path.join(tempDir, 'node_modules', 'func', 'index.js')}:1:1)`,
        ].join('\n'),
      }

      const message = formatCannotInferValueTypeError(error, { cwd: tempDir })

      expect(message).toContain('"Greet.name"')
      expect(message).toContain('src/commands/greet.command.ts:5:3')
      expect(message).toContain(
        ["> 5 |   name = 'friend'", '    |   ^^^^', '  6 | }'].join('\n'),
      )
      expect(message).not.toContain('node_modules')
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })

  test('keeps the guidance when the source location is unavailable', () => {
    const error = {
      details: {
        className: 'Greet',
        property: 'name',
      },
      stack: 'FuncError: Cannot infer value type for "name".',
    }

    const message = formatCannotInferValueTypeError(error, { cwd: process.cwd() })

    expect(message).toContain('"Greet.name"')
    expect(message).toContain('@Value({ type: String })')
  })
})
