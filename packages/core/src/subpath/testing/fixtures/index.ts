import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

export type ProjectFixtureContent = string | Uint8Array

export interface ProjectFixtureOptions {
  files?: Readonly<Record<string, ProjectFixtureContent>>
  prefix?: string
}

export interface ProjectFixture {
  readonly path: string
  cleanup(): Promise<void>
  exists(path: string): Promise<boolean>
  read(path: string): Promise<string>
  resolve(...segments: string[]): string
  write(path: string, content: ProjectFixtureContent): Promise<void>
}

class TemporaryProjectFixture implements ProjectFixture {
  private cleaned = false

  constructor(readonly path: string) {}

  async cleanup(): Promise<void> {
    if (this.cleaned) return
    this.cleaned = true
    await rm(this.path, { force: true, recursive: true })
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(this.resolve(path))
      return true
    } catch (error) {
      if (isMissingPathError(error)) return false
      throw error
    }
  }

  read(path: string): Promise<string> {
    return readFile(this.resolve(path), 'utf8')
  }

  resolve(...segments: string[]): string {
    const candidate = resolve(this.path, ...segments)
    const offset = relative(this.path, candidate)
    if (!offset.startsWith('..') && !isAbsolute(offset)) return candidate
    throw new Error(`Project fixture path escapes its root: ${segments.join('/')}`)
  }

  async write(path: string, content: ProjectFixtureContent): Promise<void> {
    const target = this.resolve(path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }
}

export const createProjectFixture = async (
  options: ProjectFixtureOptions = {},
): Promise<ProjectFixture> => {
  const prefix = options.prefix ?? 'func-project-'
  assertPrefix(prefix)
  const fixture = new TemporaryProjectFixture(await mkdtemp(join(tmpdir(), prefix)))

  try {
    for (const [path, content] of Object.entries(options.files ?? {})) {
      await fixture.write(path, content)
    }
    return fixture
  } catch (error) {
    await fixture.cleanup()
    throw error
  }
}

export const withProjectFixture = async <Result>(
  options: ProjectFixtureOptions,
  callback: (fixture: ProjectFixture) => Result | Promise<Result>,
): Promise<Result> => {
  const fixture = await createProjectFixture(options)
  try {
    return await callback(fixture)
  } finally {
    await fixture.cleanup()
  }
}

const assertPrefix = (prefix: string) => {
  if (prefix.length && !prefix.includes('/') && !prefix.includes('\\')) return
  throw new TypeError('Project fixture prefix must be a non-empty path segment.')
}

const isMissingPathError = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT'
