import { withProjectFixture } from 'func/testing/fixtures'
import { expect, test } from 'vitest'
import { cli } from '../utils/cli'

interface ProjectPackage {
  bin?: Record<string, string>
  files?: string[]
  name?: string
  version?: string
}

test('built CLI downloads, creates, and validates a real project', async () => {
  await withProjectFixture({ prefix: 'create-func-cli-' }, async project => {
    const projectName = 'func-init-e2e'
    const result = await cli.run([projectName], {
      cwd: project.path,
      env: {
        ...process.env,
        CI: 'true',
      },
      timeoutMs: 120_000,
    })

    expect(result.error).toBeUndefined()
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0)
    expect(result.stdout).toContain(`Created ${projectName}.`)
    expect(result.stdout).not.toContain('Project name:')
    expect(result.stderr).toContain('Downloading')
    expect(result.stderr).toContain('done')
    const pkg: unknown = JSON.parse(
      await project.read(`${projectName}/package.json`),
    )
    if (!isProjectPackage(pkg)) throw new TypeError('Invalid project package.')
    expect(pkg).toMatchObject({
      bin: {
        [projectName]: './dist/bin.js',
      },
      files: ['dist', 'package.json', 'README.md', 'tsconfig.json'],
      name: projectName,
      version: '0.0.0',
    })
    await expect(project.exists(`${projectName}/.gitignore`)).resolves.toBe(true)
    await expect(project.exists(`${projectName}/.npmignore`)).resolves.toBe(false)
    await expect(project.exists(`${projectName}/src/index.ts`)).resolves.toBe(true)
    await expect(project.exists(`${projectName}/tests`)).resolves.toBe(true)
  })
})

const isProjectPackage = (value: unknown): value is ProjectPackage =>
  typeof value === 'object' && value !== null
