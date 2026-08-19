import { SCAFFOLD, formatScaffoldErrorCode } from '@func/contracts/scaffold-errors'
import { withProjectFixture } from 'func/testing/fixtures'
import { mkdir } from 'node:fs/promises'
import * as tar from 'tar'
import { describe, expect, test } from 'vitest'
import { resolveTemplateTarball } from '../../src/commands/create/template'

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

  test('reports invalid package metadata with a scaffold error code', () => {
    expect(() => resolveTemplateTarball(Buffer.from('{'))).toThrow(
      expect.objectContaining({
        code: formatScaffoldErrorCode(SCAFFOLD.TEMPLATE_METADATA_INVALID),
      }),
    )
  })
})

describe('npm package tarball', () => {
  test('extracts package contents with the npm package prefix stripped', async () => {
    await withProjectFixture(
      {
        files: {
          'package/package.json': '{"name":"func-template"}\n',
        },
      },
      async project => {
        const tarball = project.resolve('func-template-1.0.0.tgz')
        const destination = project.resolve('destination')
        await mkdir(destination)
        await tar.create(
          {
            cwd: project.path,
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

        await expect(project.read('destination/package.json')).resolves.toBe(
          '{"name":"func-template"}\n',
        )
      },
    )
  })
})
