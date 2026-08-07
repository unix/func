import { describe, expect, test } from 'vitest'
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  buildWithNcc,
  buildWithRolldown,
  parseBuildArgs,
} from '../src/actions/build'

describe('parseBuildArgs', () => {
  test('parses file, out, and repeated externals', () => {
    const args = parseBuildArgs([
      '-f',
      'src/index.ts',
      '-o',
      'build',
      '-e',
      'react',
      '--external',
      'chalk',
    ])

    expect(args).toEqual({
      file: 'src/index.ts',
      out: 'build',
      external: ['react', 'chalk'],
      watch: false,
      watchPaths: [],
    })
  })

  test('parses watch and repeated watch paths', () => {
    const args = parseBuildArgs([
      '--watch',
      '--watch-path',
      'src/**/*.ts',
      '--watch-path',
      'config.json',
    ])

    expect(args.watch).toBe(true)
    expect(args.watchPaths).toEqual(['src/**/*.ts', 'config.json'])
  })

  test('requires watch when watch paths are provided', () => {
    expect(() => parseBuildArgs(['--watch-path', 'src'])).toThrow(
      'Option "--watch-path" requires "--watch".',
    )
  })

  test('writes bin file after ncc build finishes', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'funcgo-build-'))

    try {
      const output = path.join(tempDir, 'dist')
      const entry = path.join(tempDir, 'index.ts')
      const fakeNcc = path.join(tempDir, 'fake-ncc.js')
      fs.writeFileSync(entry, 'console.log("ok")\n')
      fs.writeFileSync(
        fakeNcc,
        [
          '#!/usr/bin/env node',
          'const fs = require("fs")',
          'const path = require("path")',
          'const out = process.argv[process.argv.indexOf("-o") + 1]',
          'fs.mkdirSync(out, { recursive: true })',
          'fs.writeFileSync(path.join(out, "index.js"), "module.exports = {}\\n")',
        ].join('\n'),
        { mode: 0o755 },
      )

      await buildWithNcc({
        entry,
        external: [],
        ncc: fakeNcc,
        output,
      })

      const bin = path.join(output, 'bin.js')
      expect(fs.existsSync(bin)).toBe(true)
      expect(fs.readFileSync(bin, 'utf-8')).toBe(
        "#!/usr/bin/env node\nrequire('./index.js')\n",
      )
      expect(fs.statSync(bin).mode & 0o111).toBeGreaterThan(0)
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })

  test('bundles with Rolldown and writes bin file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'funcgo-rolldown-build-'))

    try {
      const output = path.join(tempDir, 'dist')
      const entry = path.join(tempDir, 'index.ts')
      const tsconfig = path.join(tempDir, 'tsconfig.json')
      fs.writeFileSync(
        entry,
        [
          'const property = (): PropertyDecorator => () => undefined',
          'class Example {',
          '  @property()',
          '  value = "ok"',
          '}',
          'console.log(new Example().value)',
        ].join('\n'),
      )
      fs.writeFileSync(
        tsconfig,
        JSON.stringify({
          compilerOptions: {
            emitDecoratorMetadata: true,
            experimentalDecorators: true,
            target: 'ES2022',
          },
        }),
      )

      await buildWithRolldown({
        entry,
        external: [],
        output,
      })

      const bundle = path.join(output, 'index.js')
      const bin = path.join(output, 'bin.js')
      expect(fs.existsSync(bundle)).toBe(true)
      expect(fs.existsSync(bin)).toBe(true)
      expect(fs.readFileSync(bin, 'utf-8')).toBe(
        "#!/usr/bin/env node\nrequire('./index.js')\n",
      )
      expect(fs.statSync(bin).mode & 0o111).toBeGreaterThan(0)
      const result = spawnSync(process.execPath, [bin], { encoding: 'utf-8' })
      expect(result.status).toBe(0)
      expect(result.stdout).toBe('ok\n')
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })
})
