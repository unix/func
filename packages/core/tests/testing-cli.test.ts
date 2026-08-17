import { realpath } from 'node:fs/promises'
import { createCliRunner } from '../src/subpath/testing/cli'
import { withProjectFixture } from '../src/subpath/testing/fixtures'
import { expect, test } from './_test'

test('should run a packaged CLI with explicit cwd, env, and stdin', async () => {
  await withProjectFixture(
    {
      files: {
        'bin.mjs': [
          'const chunks = []',
          'for await (const chunk of process.stdin) chunks.push(chunk)',
          'process.stdout.write(JSON.stringify({',
          '  argv: process.argv.slice(2),',
          '  cwd: process.cwd(),',
          '  inheritedPath: process.env.PATH,',
          '  stdin: Buffer.concat(chunks).toString(),',
          '  visible: process.env.VISIBLE,',
          '}))',
        ].join('\n'),
        'package.json': JSON.stringify({ bin: './bin.mjs' }),
      },
    },
    async fixture => {
      const cli = createCliRunner({ packageRoot: fixture.path })
      const result = await cli.run(['deploy', '--force'], {
        cwd: fixture.path,
        env: { VISIBLE: 'testing' },
        stdin: 'confirm',
      })

      expect(result).toMatchObject({
        error: undefined,
        exitCode: 0,
        signal: null,
        stderr: '',
        timedOut: false,
      })
      expect(JSON.parse(result.stdout)).toEqual({
        argv: ['deploy', '--force'],
        cwd: await realpath(fixture.path),
        stdin: 'confirm',
        visible: 'testing',
      })
    },
  )
})

test('should require binName when a package declares multiple bins', async () => {
  await withProjectFixture(
    {
      files: {
        'first.mjs': '',
        'package.json': JSON.stringify({
          bin: { first: './first.mjs', second: './second.mjs' },
        }),
        'second.mjs': '',
      },
    },
    fixture => {
      expect(() => createCliRunner({ packageRoot: fixture.path })).toThrow(
        /provide binName/,
      )
      expect(() =>
        createCliRunner({ binName: 'second', packageRoot: fixture.path }),
      ).not.toThrow()
    },
  )
})
