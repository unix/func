import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, expect, test, vi } from 'vitest'
import { resolveWatchTargets, watchBuild } from '../src/utils/build-watch'
import type {
  WatchEvent,
  WatchSubscribe,
  WatchTarget,
} from '../src/utils/build-watch'

describe('resolveWatchTargets', () => {
  test('defaults to TypeScript files below src', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'funcgo-watch-'))
    const srcDir = path.join(tempDir, 'src')
    fs.mkdirSync(path.join(srcDir, 'nested'), { recursive: true })

    try {
      const [target] = resolveWatchTargets([], { cwd: tempDir })
      expect(target.root).toBe(srcDir)
      expect(target.matches(path.join(srcDir, 'index.ts'))).toBe(true)
      expect(target.matches(path.join(srcDir, 'nested', 'command.ts'))).toBe(true)
      expect(target.matches(path.join(srcDir, 'index.js'))).toBe(false)
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })

  test('supports files, directories, and positive globs', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'funcgo-watch-'))
    const configFile = path.join(tempDir, 'config.json')
    const srcDir = path.join(tempDir, 'src')
    fs.writeFileSync(configFile, '{}\n')
    fs.mkdirSync(srcDir)

    try {
      const [target] = resolveWatchTargets(['config.json', 'src/**/*.ts'], {
        cwd: tempDir,
      })

      expect(target.root).toBe(tempDir)
      expect(target.matches(configFile)).toBe(true)
      expect(target.matches(path.join(srcDir, 'index.ts'))).toBe(true)
      expect(target.matches(path.join(srcDir, 'index.js'))).toBe(false)
      expect(target.matches(path.join(tempDir, 'package.json'))).toBe(false)
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })

  test('watches every file below an explicit directory', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'funcgo-watch-'))
    const configDir = path.join(tempDir, 'config')
    fs.mkdirSync(configDir)

    try {
      const [target] = resolveWatchTargets(['config'], { cwd: tempDir })
      expect(target.matches(path.join(configDir, 'app.json'))).toBe(true)
      expect(target.matches(path.join(configDir, 'nested', 'app.yaml'))).toBe(true)
      expect(target.matches(path.join(tempDir, 'app.json'))).toBe(false)
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })

  test('supports brace globs from a shared static root', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'funcgo-watch-'))
    fs.mkdirSync(path.join(tempDir, 'src'))
    fs.mkdirSync(path.join(tempDir, 'shared'))

    try {
      const [target] = resolveWatchTargets(['{src,shared}/**/*.ts'], {
        cwd: tempDir,
      })

      expect(target.root).toBe(tempDir)
      expect(target.matches(path.join(tempDir, 'src', 'index.ts'))).toBe(true)
      expect(target.matches(path.join(tempDir, 'shared', 'types.ts'))).toBe(true)
      expect(target.matches(path.join(tempDir, 'tests', 'index.ts'))).toBe(false)
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })

  test('rejects negative globs and missing paths', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'funcgo-watch-'))

    try {
      expect(() => resolveWatchTargets(['!src/**/*.ts'], { cwd: tempDir })).toThrow(
        'Negative watch glob is not supported',
      )
      expect(() => resolveWatchTargets(['config.json'], { cwd: tempDir })).toThrow(
        'Watch path does not exist',
      )
      expect(() =>
        resolveWatchTargets(['missing/**/*.ts'], { cwd: tempDir }),
      ).toThrow('Watch glob base directory does not exist')
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })
})

describe('watchBuild', () => {
  test('builds immediately, filters events, survives failures, and unsubscribes', async () => {
    const controller = new AbortController()
    const error = new Error('build failed')
    const build = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined)
    const onBuildError = vi.fn()
    const onReady = vi.fn()
    const onWatchError = vi.fn()
    const harness = createSubscribeHarness()
    const target = typescriptTarget('/project/src')
    const running = watchBuild({
      build,
      cwd: '/project',
      debounceMs: 10,
      onBuildError,
      onReady,
      onWatchError,
      output: '/project/dist',
      signal: controller.signal,
      subscribe: harness.subscribe,
      targets: [target],
    })

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce())
    expect(build).toHaveBeenCalledOnce()
    expect(onBuildError).toHaveBeenCalledWith(error)
    expect(harness.ignore).toEqual([
      path.resolve('/project/dist'),
      path.resolve('/project/node_modules'),
      path.resolve('/project/.git'),
      '**/node_modules/**',
      '**/.git/**',
    ])

    harness.emit(null, [watchEvent('/project/src/index.js')])
    await Promise.resolve()
    expect(build).toHaveBeenCalledOnce()
    harness.emit(null, [watchEvent('/project/src/index.ts')])
    await vi.waitFor(() => expect(build).toHaveBeenCalledTimes(2))
    controller.abort()
    await running
    expect(harness.unsubscribe).toHaveBeenCalledOnce()
    expect(onWatchError).not.toHaveBeenCalled()
  })

  test('coalesces changes received during a build into one follow-up build', async () => {
    const controller = new AbortController()
    let finishSecondBuild: (() => void) | undefined
    const secondBuild = new Promise<void>(resolve => {
      finishSecondBuild = resolve
    })
    const build = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(secondBuild)
      .mockResolvedValue(undefined)
    const harness = createSubscribeHarness()
    const running = watchBuild({
      build,
      cwd: '/project',
      debounceMs: 10,
      onBuildError: vi.fn(),
      onWatchError: vi.fn(),
      output: '/project/dist',
      signal: controller.signal,
      subscribe: harness.subscribe,
      targets: [typescriptTarget('/project/src')],
    })

    await vi.waitFor(() => expect(build).toHaveBeenCalledOnce())
    harness.emit(null, [watchEvent('/project/src/first.ts')])
    await vi.waitFor(() => expect(build).toHaveBeenCalledTimes(2))
    harness.emit(null, [watchEvent('/project/src/second.ts')])
    harness.emit(null, [watchEvent('/project/src/third.ts')])
    finishSecondBuild?.()
    await vi.waitFor(() => expect(build).toHaveBeenCalledTimes(3))
    controller.abort()
    await running
  })

  test('debounces rapid changes into one rebuild', async () => {
    const controller = new AbortController()
    const build = vi.fn().mockResolvedValue(undefined)
    const harness = createSubscribeHarness()
    const running = watchBuild({
      build,
      cwd: '/project',
      debounceMs: 20,
      onBuildError: vi.fn(),
      onWatchError: vi.fn(),
      output: '/project/dist',
      signal: controller.signal,
      subscribe: harness.subscribe,
      targets: [typescriptTarget('/project/src')],
    })

    await vi.waitFor(() => expect(build).toHaveBeenCalledOnce())
    harness.emit(null, [watchEvent('/project/src/first.ts')])
    harness.emit(null, [watchEvent('/project/src/second.ts')])
    harness.emit(null, [watchEvent('/project/src/third.ts')])
    await new Promise(resolve => setTimeout(resolve, 5))
    expect(build).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(build).toHaveBeenCalledTimes(2))
    controller.abort()
    await running
  })

  test('reports watcher errors without triggering a build', async () => {
    const controller = new AbortController()
    const build = vi.fn().mockResolvedValue(undefined)
    const onWatchError = vi.fn()
    const harness = createSubscribeHarness()
    const running = watchBuild({
      build,
      cwd: '/project',
      onBuildError: vi.fn(),
      onWatchError,
      output: '/project/dist',
      signal: controller.signal,
      subscribe: harness.subscribe,
      targets: [typescriptTarget('/project/src')],
    })

    await vi.waitFor(() => expect(build).toHaveBeenCalledOnce())
    const error = new Error('watch failed')
    harness.emit(error, [])
    expect(onWatchError).toHaveBeenCalledWith(error)
    expect(build).toHaveBeenCalledOnce()
    controller.abort()
    await running
  })
})

interface SubscribeHarness {
  emit: (error: Error | null, events: WatchEvent[]) => void
  ignore: Array<string | RegExp>
  subscribe: WatchSubscribe
  unsubscribe: ReturnType<typeof vi.fn<() => Promise<void>>>
}

const createSubscribeHarness = (): SubscribeHarness => {
  let callback: Parameters<WatchSubscribe>[1] | undefined
  let ignore: Array<string | RegExp> = []
  const unsubscribe = vi.fn(async (): Promise<void> => {})
  const subscribe: WatchSubscribe = async (_directory, nextCallback, options) => {
    callback = nextCallback
    ignore = options?.ignore ?? []
    return { unsubscribe }
  }

  return {
    emit: (error, events) => callback?.(error, events),
    get ignore() {
      return ignore
    },
    subscribe,
    unsubscribe,
  }
}

const typescriptTarget = (root: string): WatchTarget => {
  return {
    root,
    matches: file => file.endsWith('.ts'),
  }
}

const watchEvent = (target: string): WatchEvent => {
  return {
    path: target,
    type: 'update',
  }
}
