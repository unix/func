import { SCAFFOLD, ScaffoldException } from '@func/contracts/scaffold-errors'
import { watch as watchFiles } from 'chokidar'
import fs from 'fs'
import path from 'path'
import picomatch from 'picomatch'

const DEFAULT_WATCH_PATTERN = 'src/**/*.ts'
const DEFAULT_BUILD_DEBOUNCE_MS = 200

export interface WatchTarget {
  matches: (file: string) => boolean
  root: string
}

export interface ResolveWatchTargetsOptions {
  cwd: string
}

export interface WatchBuildOptions {
  build: () => Promise<void>
  cwd: string
  debounceMs?: number
  onBuildError: (error: unknown) => void
  onReady?: () => void
  onWatchError: (error: Error) => void
  output: string
  signal: AbortSignal
  subscribe?: WatchSubscribe
  targets: WatchTarget[]
}

export interface WatchEvent {
  path: string
  type: 'create' | 'update' | 'delete'
}

export interface WatchSubscription {
  unsubscribe: () => Promise<void>
}

export type WatchSubscribe = (
  directory: string,
  callback: (error: Error | null, events: WatchEvent[]) => unknown,
  options?: {
    ignore?: Array<string | RegExp>
  },
) => Promise<WatchSubscription>

export const resolveWatchTargets = (
  watchPaths: string[],
  options: ResolveWatchTargetsOptions,
): WatchTarget[] => {
  const paths = watchPaths.length ? watchPaths : [DEFAULT_WATCH_PATTERN]
  const targets = paths.map(item => resolveWatchTarget(item, options.cwd))
  return mergeWatchTargets(targets)
}

export const watchBuild = async (options: WatchBuildOptions): Promise<void> => {
  if (options.signal.aborted) return
  const subscribe = options.subscribe ?? subscribeWithChokidar
  const subscriptions: WatchSubscription[] = []
  const debounceMs = Math.max(0, options.debounceMs ?? DEFAULT_BUILD_DEBOUNCE_MS)
  let activeBuild: Promise<void> | undefined
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  const state = {
    pendingBuild: false,
    stopped: false,
  }
  const shouldBuildAgain = (): boolean => state.pendingBuild && !state.stopped

  const scheduleBuild = (): Promise<void> => {
    if (state.stopped) return Promise.resolve()
    if (activeBuild) {
      state.pendingBuild = true
      return activeBuild
    }

    activeBuild = (async () => {
      do {
        state.pendingBuild = false
        try {
          await options.build()
        } catch (error) {
          if (!options.signal.aborted) options.onBuildError(error)
        }
      } while (shouldBuildAgain())
    })().finally(() => {
      activeBuild = undefined
    })

    return activeBuild
  }

  const scheduleDebouncedBuild = (): void => {
    if (state.stopped) return
    if (debounceTimer) clearTimeout(debounceTimer)

    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      void scheduleBuild()
    }, debounceMs)
    debounceTimer.unref()
  }

  try {
    for (const target of options.targets) {
      const subscription = await subscribe(
        target.root,
        (error, events) => {
          if (error) {
            options.onWatchError(error)
            return
          }

          const shouldBuild = events.some(event =>
            target.matches(normalizePath(event.path)),
          )
          if (!shouldBuild) return
          scheduleDebouncedBuild()
        },
        {
          ignore: [
            ...uniquePaths([
              options.output,
              path.join(options.cwd, 'node_modules'),
              path.join(options.cwd, '.git'),
            ]),
            '**/node_modules/**',
            '**/.git/**',
          ],
        },
      )
      subscriptions.push(subscription)
    }

    await scheduleBuild()
    options.onReady?.()
    await waitForAbort(options.signal)
  } finally {
    state.stopped = true
    if (debounceTimer) clearTimeout(debounceTimer)
    await Promise.all(
      subscriptions.map(async subscription => {
        try {
          await subscription.unsubscribe()
        } catch (error) {
          options.onWatchError(asError(error))
        }
      }),
    )
    await activeBuild
  }
}

const subscribeWithChokidar: WatchSubscribe = async (
  directory,
  callback,
  options,
) => {
  const watcher = watchFiles(directory, {
    ignored: createIgnoreMatcher(directory, options?.ignore ?? []),
    ignoreInitial: true,
  })

  watcher.on('all', (event, file) => {
    const type = watchEventType(event)
    if (!type) return
    callback(null, [
      {
        path: path.resolve(directory, file),
        type,
      },
    ])
  })
  watcher.on('error', error => callback(asError(error), []))
  await new Promise<void>(resolve => watcher.once('ready', resolve))

  return {
    unsubscribe: () => watcher.close(),
  }
}

const createIgnoreMatcher = (
  directory: string,
  patterns: Array<string | RegExp>,
): ((file: string) => boolean) => {
  const matchers = patterns.map(pattern => {
    if (pattern instanceof RegExp) {
      return (file: string): boolean => {
        pattern.lastIndex = 0
        return pattern.test(file)
      }
    }

    const normalizedPattern = normalizePath(path.resolve(directory, pattern))
    if (picomatch.scan(normalizedPattern).isGlob) {
      return picomatch(normalizedPattern, {
        dot: true,
        nocase: process.platform === 'win32',
      })
    }

    return (file: string): boolean => isPathInside(normalizedPattern, file)
  })

  return file => {
    const normalizedFile = normalizePath(path.resolve(directory, file))
    return matchers.some(matches => matches(normalizedFile))
  }
}

const watchEventType = (event: string): WatchEvent['type'] | undefined => {
  if (event === 'change') return 'update'
  if (event === 'add' || event === 'addDir') return 'create'
  if (event === 'unlink' || event === 'unlinkDir') return 'delete'
}

const resolveWatchTarget = (watchPath: string, cwd: string): WatchTarget => {
  const scan = picomatch.scan(normalizePath(watchPath))
  if (scan.negated) {
    throw new ScaffoldException(SCAFFOLD.NEGATIVE_WATCH_GLOB, {
      details: { watchPath },
      message: `Negative watch glob is not supported: "${watchPath}".`,
    })
  }

  const absolutePath = path.resolve(cwd, watchPath)
  if (fs.existsSync(absolutePath)) {
    const stat = fs.statSync(absolutePath)
    if (stat.isDirectory()) {
      return {
        root: absolutePath,
        matches: file => isPathInside(absolutePath, file),
      }
    }

    return {
      root: path.dirname(absolutePath),
      matches: file => normalizePath(file) === normalizePath(absolutePath),
    }
  }

  if (!scan.isGlob) {
    throw new ScaffoldException(SCAFFOLD.WATCH_PATH_NOT_FOUND, {
      details: { watchPath },
      message: `Watch path does not exist: "${watchPath}".`,
    })
  }

  const absolutePattern = normalizePath(path.resolve(cwd, watchPath))
  const absoluteScan = picomatch.scan(absolutePattern)
  const root = path.resolve(absoluteScan.base || cwd)
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new ScaffoldException(SCAFFOLD.WATCH_GLOB_BASE_NOT_FOUND, {
      details: { root, watchPath },
      message: `Watch glob base directory does not exist: "${watchPath}".`,
    })
  }

  const matches = picomatch(absolutePattern, {
    dot: true,
    nocase: process.platform === 'win32',
  })

  return {
    root,
    matches,
  }
}

const mergeWatchTargets = (targets: WatchTarget[]): WatchTarget[] => {
  const merged: Array<WatchTarget & { matchers: Array<(file: string) => boolean> }> =
    []
  const ordered = [...targets].sort(
    (left, right) => left.root.length - right.root.length,
  )

  ordered.forEach(target => {
    const parent = merged.find(item => isPathInside(item.root, target.root))
    if (parent) {
      parent.matchers.push(target.matches)
      return
    }

    const matchers = [target.matches]
    merged.push({
      root: target.root,
      matchers,
      matches: file => matchers.some(matches => matches(file)),
    })
  })

  return merged.map(({ root, matches }) => ({ root, matches }))
}

const isPathInside = (parent: string, target: string): boolean => {
  const relative = path.relative(parent, target)

  return (
    relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
  )
}

const normalizePath = (target: string): string => {
  return target.replace(/\\/g, '/')
}

const uniquePaths = (paths: string[]): string[] => {
  return [...new Set(paths.filter(Boolean).map(item => path.resolve(item)))]
}

const waitForAbort = async (signal: AbortSignal): Promise<void> => {
  if (signal.aborted) return

  await new Promise<void>(resolve => {
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

const asError = (error: unknown): Error => {
  return error instanceof Error ? error : new Error(String(error))
}
