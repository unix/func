import { describe, expect, test } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { buildWithNcc, parseBuildArgs } from '../src/actions/build'

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
    })
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
})
