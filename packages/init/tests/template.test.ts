import { describe, expect, test } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import * as tar from 'tar'
import { resolveTemplateTarball } from '../src/template'

describe('resolveTemplateTarball', () => {
  test('reads npm package metadata', () => {
    const metadata = Buffer.from(
      JSON.stringify({
        dist: {
          tarball:
            'https://registry.npmjs.org/func-template/-/func-template-1.0.0.tgz',
        },
      }),
    )

    expect(resolveTemplateTarball(metadata)).toBe(
      'https://registry.npmjs.org/func-template/-/func-template-1.0.0.tgz',
    )
  })
})

describe('npm package tarball', () => {
  test('extracts package contents with the npm package prefix stripped', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-func-template-'))

    try {
      const sourceDir = path.join(tempDir, 'package')
      const tarball = path.join(tempDir, 'func-template-1.0.0.tgz')
      const destination = path.join(tempDir, 'destination')

      fs.mkdirSync(sourceDir)
      fs.mkdirSync(destination)
      fs.writeFileSync(
        path.join(sourceDir, 'package.json'),
        '{"name":"func-template"}\n',
      )
      await tar.create(
        {
          cwd: tempDir,
          file: tarball,
          gzip: true,
        },
        ['package'],
      )

      await tar.extract({
        cwd: destination,
        file: tarball,
        strip: 1,
      })

      expect(fs.readFileSync(path.join(destination, 'package.json'), 'utf-8')).toBe(
        '{"name":"func-template"}\n',
      )
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })
})
