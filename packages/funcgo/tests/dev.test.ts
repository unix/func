import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, expect, test } from 'vitest'
import { parseDevArgs } from '../src/actions/dev'
import {
  formatCannotInferValueTypeError,
  isCannotInferValueTypeError,
} from '../src/utils/dev-error-format'
import { formatSystemError, isSystemError } from '../src/utils/system-error-format'

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
    const args = parseDevArgs(['hello', '--name', 'unix'])
    expect(args.userArgs).toEqual(['hello', '--name', 'unix'])
  })

  test('rejects unknown options before passthrough starts', () => {
    expect(() => parseDevArgs(['--name', 'unix'])).toThrow('Unknown option: --name.')
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

  test('does not treat other system errors as type inference failures', () => {
    const error = {
      code: 'F_SYSTEM_INVALID_FIELD_DECORATOR_TARGET',
      details: {
        property: 'verbose',
      },
      message: 'Field option "verbose" must decorate an instance property.',
    }

    expect(isCannotInferValueTypeError(error)).toBe(false)
    expect(isSystemError(error)).toBe(true)
  })

  test('formats system errors from their code and structured details', () => {
    const message = formatSystemError({
      code: 'F_SYSTEM_DUPLICATE_COMMAND_TOKEN',
      details: {
        handlers: ['FirstCommand', 'SecondCommand'],
        token: 'status',
      },
      message: 'F_SYSTEM_DUPLICATE_COMMAND_TOKEN',
    })

    expect(message).toContain('A command token is registered more than once.')
    expect(message).toContain('F_SYSTEM_DUPLICATE_COMMAND_TOKEN')
    expect(message).toContain("token: 'status'")
  })

  test('formats property type guidance', () => {
    const error = {
      details: {
        property: 'name',
      },
    }

    expect(formatCannotInferValueTypeError(error)).toContain('name!: string')
    expect(formatCannotInferValueTypeError(error)).toContain(
      'ensure emitDecoratorMetadata is enabled',
    )
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
          'InternalException: Cannot infer value type for "name".',
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
      stack: 'InternalException: Cannot infer value type for "name".',
    }

    const message = formatCannotInferValueTypeError(error, { cwd: process.cwd() })
    expect(message).toContain('"Greet.name"')
    expect(message).toContain('name!: string')
  })
})
