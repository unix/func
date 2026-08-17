import { expect, test } from 'vitest'
import { withProjectFixture } from 'func/testing/fixtures'
import { cli } from '../utils/cli'

test('built CLI should run from an isolated project', async () => {
  await withProjectFixture(
    { files: { 'package.json': '{"name":"test-project"}' } },
    async project => {
      const result = await cli.run(['greet', '--name', 'func'], {
        cwd: project.path,
        env: { ...process.env },
      })

      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toMatch(/Hello, func!/)
    },
  )
})
