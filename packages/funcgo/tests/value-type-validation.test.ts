import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, expect, test } from 'vitest'
import { buildWithRolldown } from '../src/actions/build'
import { errorTrackingUrl } from '../src/utils/error-tracking'

describe('Value type build validation', () => {
  test('reports every definite runtime type error with source context', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'funcgo-value-validation-'),
    )

    try {
      const entry = path.join(tempDir, 'src', 'index.ts')
      const output = path.join(tempDir, 'dist')
      fs.mkdirSync(path.dirname(entry), { recursive: true })
      fs.writeFileSync(
        entry,
        [
          "import { Value as FieldValue } from 'func'",
          "import * as Func from 'func'",
          '',
          'class Greeting {',
          '  @FieldValue()',
          "  name = 'friend'",
          '}',
          '',
          'class Options {',
          '  @Func.Value()',
          '  when: Date = new Date()',
          '',
          '  @FieldValue({ alias: "t" })',
          '  tags: string[] = []',
          '}',
          '',
          'console.log(Greeting, Options)',
        ].join('\n'),
      )
      writeTsconfig(tempDir)

      const result = await buildWithRolldown({
        entry,
        external: ['func'],
        output,
      }).then(
        () => undefined,
        (caught: unknown) => caught,
      )

      expect(result).toBeInstanceOf(Error)
      const message = (result as Error).message
      expect(message).toContain(
        'Cannot automatically infer runtime types for 3 @Value properties',
      )
      expect(message).toContain('1. "Greeting.name"')
      expect(message).toContain('2. "Options.when" (declared as "Date")')
      expect(message).toContain('3. "Options.tags" (declared as "string[]")')
      expect(message).toContain('src/index.ts:6:3')
      expect(message).toContain("6 |   name = 'friend'")
      expect(message).toContain('@Value({ type: String })')
      expect(errorTrackingUrl(result)).toBe(
        'https://f.witt.im/CANNOT_INFER_VALUE_TYPE',
      )
      expect(fs.existsSync(path.join(output, 'bin.js'))).toBe(false)
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })

  test('keeps the focused guidance for a single error', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'funcgo-value-validation-'),
    )

    try {
      const entry = path.join(tempDir, 'src', 'index.ts')
      const output = path.join(tempDir, 'dist')
      fs.mkdirSync(path.dirname(entry), { recursive: true })
      fs.writeFileSync(
        entry,
        [
          "import { Value } from 'func'",
          '',
          'class Greeting {',
          '  @Value({ alias: "n" })',
          "  name = 'friend'",
          '}',
          '',
          'console.log(Greeting)',
        ].join('\n'),
      )
      writeTsconfig(tempDir)

      const result = await buildWithRolldown({
        entry,
        external: ['func'],
        output,
      }).then(
        () => undefined,
        (caught: unknown) => caught,
      )

      expect(result).toBeInstanceOf(Error)
      const message = (result as Error).message
      expect(message).toContain(
        'Cannot automatically infer the runtime type for "Greeting.name".',
      )
      expect(message).toContain('src/index.ts:5:3')
      expect(message).toContain("name = 'friend'")
      expect(message).toContain('name!: string')
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })

  test('allows supported, explicit, and statically ambiguous runtime types', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'funcgo-value-validation-'),
    )

    try {
      const entry = path.join(tempDir, 'src', 'index.ts')
      const localDecorator = path.join(tempDir, 'src', 'local.ts')
      const output = path.join(tempDir, 'dist')
      fs.mkdirSync(path.dirname(entry), { recursive: true })
      fs.writeFileSync(
        localDecorator,
        'export const Value = (): PropertyDecorator => () => undefined\n',
      )
      fs.writeFileSync(
        entry,
        [
          "import { Value } from 'func'",
          "import { Value as LocalValue } from './local'",
          '',
          'type Text = string',
          'const valueOptions = { type: String }',
          '',
          'class Options {',
          '  @Value()',
          "  direct: string = 'value'",
          '',
          '  @Value({ type: String })',
          "  explicit = 'value'",
          '',
          '  @Value()',
          "  alias: Text = 'value'",
          '',
          '  @Value(valueOptions)',
          "  dynamic = 'value'",
          '',
          '  @LocalValue()',
          "  unrelated = 'value'",
          '}',
          '',
          'console.log(Options)',
        ].join('\n'),
      )
      writeTsconfig(tempDir)

      await buildWithRolldown({
        entry,
        external: ['func'],
        output,
      })

      expect(fs.existsSync(path.join(output, 'index.js'))).toBe(true)
      expect(fs.existsSync(path.join(output, 'bin.js'))).toBe(true)
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })
})

const writeTsconfig = (directory: string): void => {
  fs.writeFileSync(
    path.join(directory, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
        target: 'ES2022',
      },
    }),
  )
}
