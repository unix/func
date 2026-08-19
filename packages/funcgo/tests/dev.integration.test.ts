import fs from 'fs'
import os from 'os'
import path from 'path'
import { expect, test, vi } from 'vitest'
import { dev } from '../src/actions/dev'
import { prepareDevBundle } from '../src/utils/dev-cache'

vi.mock('../src/utils/dev-error-handler-path', async () => {
  const nodePath = await import('node:path')

  return {
    resolveDevErrorHandler: () =>
      nodePath.resolve(process.cwd(), 'tests/fixtures/noop-error-handler.cjs'),
  }
})

test('dev should cache an application bundle and Node compilation', async () => {
  const previousExitCode = process.exitCode
  const previousCacheRoot = process.env.FUNCGO_CACHE_DIR
  const previousCompileCache = process.env.NODE_COMPILE_CACHE
  const cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'funcgo dev & cache-'))
  const entry = path.resolve('../../examples/json-output/src/index.ts')
  process.env.FUNCGO_CACHE_DIR = cacheRoot
  delete process.env.NODE_COMPILE_CACHE

  try {
    await dev({
      file: entry,
      userArgs: ['status', '--json'],
    })
    const cached = prepareDevBundle({ cwd: process.cwd(), entry })
    expect(cached.hit).toBe(true)
    expect(fs.existsSync(cached.compileCache)).toBe(true)

    await dev({
      file: entry,
      userArgs: ['status', '--json'],
    })

    expect(process.exitCode ?? 0).toBe(0)
  } finally {
    process.exitCode = previousExitCode
    if (previousCacheRoot === undefined) delete process.env.FUNCGO_CACHE_DIR
    else process.env.FUNCGO_CACHE_DIR = previousCacheRoot
    if (previousCompileCache === undefined) delete process.env.NODE_COMPILE_CACHE
    else process.env.NODE_COMPILE_CACHE = previousCompileCache
    fs.rmSync(cacheRoot, { force: true, recursive: true })
  }
})
