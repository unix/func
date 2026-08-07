import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterAll, describe, expect, test } from 'vitest'

const initRoot = process.cwd()
const temporaryRoot = mkdtempSync(join(tmpdir(), 'create-func-e2e-'))
const projectName = 'func-init-e2e'
const projectRoot = join(temporaryRoot, projectName)

interface CommandResult {
  stderr: string
  stdout: string
}

interface ProjectPackage {
  bin?: Record<string, string>
  files?: string[]
  name?: string
  version?: string
}

const run = (command: string, args: string[], cwd: string): CommandResult => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: 'true',
    },
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
  })

  if (result.error) throw result.error
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)

  return {
    stderr: result.stderr,
    stdout: result.stdout,
  }
}

afterAll(() => {
  rmSync(temporaryRoot, { force: true, recursive: true })
})

describe('built create-func package', () => {
  test('downloads, creates, and validates a real project', () => {
    const entry = join(initRoot, 'dist', 'index.js')
    expect(existsSync(entry)).toBe(true)

    const create = run(process.execPath, [entry, projectName], temporaryRoot)
    expect(create.stdout).toContain(`Created ${projectName}.`)
    expect(create.stdout).not.toContain('Project name:')
    expect(create.stderr).toContain('Downloading')
    expect(create.stderr).toContain('done')

    const packagePath = join(projectRoot, 'package.json')
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as ProjectPackage
    expect(pkg).toMatchObject({
      bin: {
        [projectName]: './dist/bin.js',
      },
      files: ['dist', 'package.json', 'README.md', 'tsconfig.json'],
      name: projectName,
      version: '0.0.0',
    })
    expect(existsSync(join(projectRoot, '.gitignore'))).toBe(true)
    expect(existsSync(join(projectRoot, '.npmignore'))).toBe(false)
    expect(existsSync(join(projectRoot, 'src', 'index.ts'))).toBe(true)
    expect(existsSync(join(projectRoot, 'tests'))).toBe(true)
  })
})
