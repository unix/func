import { describe, expect, expectTypeOf, test } from 'vitest'
import { createParser } from '../src/subpath/parser'
import type { ParserError } from '../src/subpath/parser'

describe('parser subpath', () => {
  test('parses root and one-level command options into typed properties', () => {
    const parser = createParser({
      options: {
        help: { alias: 'h', type: Boolean },
        profile: String,
        tags: { multiple: true, name: 'tag', type: String },
      },
      commands: {
        build: {
          options: {
            count: { type: Number },
            watch: { alias: 'w', type: Boolean },
            watchPaths: {
              multiple: true,
              name: 'watch-path',
              type: String,
            },
          },
        },
      },
    })

    const result = parser.parse([
      '--profile',
      'development',
      '--tag',
      'first',
      'build',
      '--profile=production',
      '--tag',
      'second',
      '-w',
      '--watch-path',
      'src',
      '--watch-path',
      'tests',
      '--count',
      '-2',
      'entry.ts',
    ])

    expect(result.command).toBe('build')
    if (result.command !== 'build') throw new TypeError('Expected build command.')
    expectTypeOf(result.options.watchPaths).toEqualTypeOf<readonly string[]>()
    expectTypeOf(result.options.count).toEqualTypeOf<number | undefined>()
    expect(result).toEqual({
      command: 'build',
      inputs: ['entry.ts'],
      options: {
        count: -2,
        help: false,
        profile: 'production',
        tags: ['first', 'second'],
        watch: true,
        watchPaths: ['src', 'tests'],
      },
      supplied: new Set(['profile', 'tags', 'watch', 'watchPaths', 'count']),
    })
    expect(Object.getPrototypeOf(result.options)).toBeNull()
    expect(Object.isFrozen(result.options)).toBe(true)
    expect(Object.isFrozen(result.options.watchPaths)).toBe(true)
  })

  test('preserves passthrough inputs after the first positional or delimiter', () => {
    const parser = createParser({
      commands: {
        dev: {
          options: {
            file: { alias: 'f', type: String },
          },
          passthrough: true,
        },
      },
    })

    expect(
      parser.parse(['dev', '-f', 'src/index.ts', 'hello', '--name', 'unix']),
    ).toMatchObject({
      command: 'dev',
      inputs: ['hello', '--name', 'unix'],
      options: { file: 'src/index.ts' },
    })
    expect(
      parser.parse(['dev', '--file=src/index.ts', '--', '--name', 'unix']),
    ).toMatchObject({
      command: 'dev',
      inputs: ['--name', 'unix'],
      options: { file: 'src/index.ts' },
    })
    expect(parser.parse(['--', 'dev', '--file', 'user-value'])).toMatchObject({
      command: 'dev',
      inputs: ['--file', 'user-value'],
      options: { file: undefined },
    })
  })

  test('supports root-only parsers, defaults, and negatable flags', () => {
    const parser = createParser({
      options: {
        color: { negatable: true, type: Boolean },
        files: { multiple: true, type: String },
        port: Number,
      },
    })

    expect(parser.parse(['--no-color', 'input.ts'])).toEqual({
      command: undefined,
      inputs: ['input.ts'],
      options: {
        color: false,
        files: [],
        port: undefined,
      },
      supplied: new Set(['color']),
    })
  })

  test('rejects unknown commands, options, and invalid values', () => {
    const parser = createParser({
      commands: {
        build: {
          options: {
            count: Number,
          },
        },
      },
    })

    expect(() => parser.parse(['deploy'])).toThrow(
      expect.objectContaining<Partial<ParserError>>({
        code: 'unknown-command',
        message: 'Unknown command "deploy".',
      }),
    )
    expect(() => parser.parse(['build', '--force'])).toThrow(
      expect.objectContaining<Partial<ParserError>>({
        code: 'unknown-option',
        message: 'Unknown option: --force.',
      }),
    )
    expect(() => parser.parse(['build', '--count', 'many'])).toThrow(
      expect.objectContaining<Partial<ParserError>>({
        code: 'invalid-argument',
        message: 'Option "--count" must be a finite number.',
      }),
    )
  })

  test('validates public schemas before compiling internal plans', () => {
    expect(() =>
      createParser({
        options: {
          first: { alias: 'f', type: Boolean },
          second: { alias: 'f', type: String },
        },
      }),
    ).toThrow(
      expect.objectContaining<Partial<ParserError>>({
        code: 'invalid-definition',
        message: 'Duplicate parser option token "-f".',
      }),
    )
    expect(() =>
      createParser({
        options: {
          value: { alias: 'long', type: String },
        },
      }),
    ).toThrow(
      expect.objectContaining<Partial<ParserError>>({
        code: 'invalid-definition',
      }),
    )
  })
})
