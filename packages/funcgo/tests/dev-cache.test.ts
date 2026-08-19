import fs from 'fs'
import os from 'os'
import path from 'path'
import { expect, test, vi } from 'vitest'
import {
  commitDevBundle,
  discardDevBundle,
  prepareDevBundle,
} from '../src/utils/dev-cache'

test('persists a valid dev bundle and invalidates it when an input changes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'funcgo-dev-cache-'))
  const project = path.join(directory, 'project')
  const cacheRoot = path.join(directory, 'cache')
  const entry = path.join(project, 'src', 'index.ts')
  const dependency = path.join(project, 'src', 'command.ts')
  fs.mkdirSync(path.dirname(entry), { recursive: true })
  fs.writeFileSync(entry, "import './command'\n")
  fs.writeFileSync(dependency, 'export const command = true\n')
  fs.writeFileSync(path.join(project, 'package.json'), '{"name":"fixture"}\n')

  try {
    const initial = prepareDevBundle({ cacheRoot, cwd: project, entry })
    expect(initial.hit).toBe(false)
    fs.writeFileSync(initial.file, 'console.log("ready")\n')
    commitDevBundle(initial, [entry, dependency])
    const cached = prepareDevBundle({ cacheRoot, cwd: project, entry })
    expect(cached.hit).toBe(true)
    expect(cached.file).toBe(initial.file)
    fs.appendFileSync(dependency, 'export const changed = true\n')
    const invalidated = prepareDevBundle({ cacheRoot, cwd: project, entry })
    expect(invalidated.hit).toBe(false)
    expect(invalidated.file).not.toBe(initial.file)
    discardDevBundle(invalidated)
  } finally {
    fs.rmSync(directory, { force: true, recursive: true })
  }
})

test('invalidates a cached bundle when project metadata changes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'funcgo-dev-cache-'))
  const project = path.join(directory, 'project')
  const cacheRoot = path.join(directory, 'cache')
  const entry = path.join(project, 'index.ts')
  const packageFile = path.join(project, 'package.json')
  fs.mkdirSync(project, { recursive: true })
  fs.writeFileSync(entry, 'console.log("ready")\n')
  fs.writeFileSync(packageFile, '{"name":"first"}\n')

  try {
    const initial = prepareDevBundle({ cacheRoot, cwd: project, entry })
    fs.writeFileSync(initial.file, 'console.log("ready")\n')
    commitDevBundle(initial, [entry])
    expect(prepareDevBundle({ cacheRoot, cwd: project, entry }).hit).toBe(true)
    fs.writeFileSync(packageFile, '{"name":"second-version"}\n')
    const invalidated = prepareDevBundle({ cacheRoot, cwd: project, entry })
    expect(invalidated.hit).toBe(false)
    discardDevBundle(invalidated)
  } finally {
    fs.rmSync(directory, { force: true, recursive: true })
  }
})

test('treats cache cleanup failures as best-effort', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'funcgo-dev-cache-'))
  const project = path.join(directory, 'project')
  const cacheRoot = path.join(directory, 'cache')
  const entry = path.join(project, 'index.ts')
  fs.mkdirSync(project, { recursive: true })
  fs.writeFileSync(entry, 'console.log("ready")\n')

  try {
    const bundle = prepareDevBundle({ cacheRoot, cwd: project, entry })
    const remove = vi.spyOn(fs, 'rmSync').mockImplementationOnce(() => {
      throw Object.assign(new Error('File is busy.'), { code: 'EBUSY' })
    })
    expect(() => discardDevBundle(bundle)).not.toThrow()
    expect(remove).toHaveBeenCalledWith(bundle.output, {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 50,
    })
    remove.mockRestore()
  } finally {
    vi.restoreAllMocks()
    fs.rmSync(directory, { force: true, recursive: true })
  }
})
