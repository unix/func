import { SCAFFOLD, ScaffoldException } from '@func/contracts/scaffold-errors'
import fs from 'fs'
import path from 'path'
import { funcgoParser } from '../parser'
import { applicationPrecompilePlugin } from '../plugins/application-precompile'
import { valueTypeValidationPlugin } from '../plugins/value-type-validation'
import { resolveWatchTargets, watchBuild } from '../utils/build-watch'
import { withErrorTrackingUrl } from '../utils/error-tracking'
import * as spinner from '../utils/spinner'
import { cwd, readPackage, resolveEntry } from '../utils/paths'
import { formatSystemError, isSystemError } from '../utils/system-error-format'

export interface BuildArgs {
  file?: string
  out?: string
  external: string[]
  watch: boolean
  watchPaths: string[]
}

export const build = async (input: string[] | BuildArgs): Promise<void> => {
  const args = Array.isArray(input) ? parseBuildArgs(input) : input
  await runBuild(args)
}

interface ProjectBuildOptions {
  entry: string
  external: string[]
  output: string
  precompile?: 'auto' | 'required' | false
}

const runBuild = async (args: BuildArgs): Promise<void> => {
  const pkg = readPackage()
  const entry = resolveEntry(args.file)
  if (!entry) {
    throw new ScaffoldException(SCAFFOLD.ENTRY_NOT_FOUND, {
      details: { entry: args.file },
      message: 'About. Not found entry. Run "funcgo setup" for suggestions.',
    })
  }
  const output = path.resolve(cwd, args.out ?? pkg.func?.outDir ?? 'dist')

  const buildOptions = {
    entry,
    external: args.external,
    output,
    precompile: pkg.func?.precompile,
  }
  if (!args.watch) {
    await buildWithRolldown(buildOptions)
    return
  }

  const controller = new AbortController()
  const stopWatching = (): void => controller.abort()
  process.once('SIGINT', stopWatching)
  process.once('SIGTERM', stopWatching)
  let initialBuild = true

  try {
    await watchBuild({
      build: async () => {
        if (!initialBuild) spinner.newline()
        initialBuild = false
        await buildWithRolldown(buildOptions)
      },
      cwd,
      onBuildError: printError,
      onReady: () => spinner.info('Watching for changes...', 'Press Ctrl+C to stop'),
      onWatchError: error => spinner.error('Watch error', error.message),
      output,
      signal: controller.signal,
      targets: resolveWatchTargets(args.watchPaths, { cwd }),
    })
  } finally {
    process.off('SIGINT', stopWatching)
    process.off('SIGTERM', stopWatching)
  }
}

export const buildWithRolldown = async (
  options: ProjectBuildOptions,
): Promise<void> => {
  const startedAt = performance.now()
  spinner.start('Bundling...')
  try {
    const { build: bundle } = await import('rolldown')
    const tsconfig = resolveTsconfig(options.entry)
    await bundle({
      input: options.entry,
      external: options.external,
      platform: 'node',
      plugins: [
        applicationPrecompilePlugin({
          entry: options.entry,
          mode: options.precompile ?? 'auto',
          tsconfig,
        }),
        valueTypeValidationPlugin({ cwd }),
      ],
      tsconfig,
      transform: {
        target: 'node24.15',
      },
      output: {
        codeSplitting: false,
        file: path.join(options.output, 'index.js'),
        format: 'cjs',
        minify: true,
      },
    })
    writeBin(options.output)
    spinner.succeed(`Bundled in ${formatDuration(performance.now() - startedAt)}`)
  } catch (error) {
    spinner.fail('Build failed')
    throw error
  }
}

export const parseBuildArgs = (argv: string[]): BuildArgs => {
  const parsed = funcgoParser.parse(['build', ...argv])
  if (parsed.command !== 'build') {
    throw new ScaffoldException(SCAFFOLD.INTERNAL_COMMAND_MISMATCH, {
      details: { actual: parsed.command, expected: 'build' },
      message: 'Expected build command.',
    })
  }
  const result = {
    external: parsed.options.external.slice(),
    file: parsed.options.file,
    out: parsed.options.out,
    watch: parsed.options.watch,
    watchPaths: parsed.options.watchPaths.slice(),
  }
  if (result.watchPaths.length && !result.watch) {
    throw new ScaffoldException(SCAFFOLD.WATCH_REQUIRES_WATCH, {
      details: { watchPaths: result.watchPaths },
      message: 'Option "--watch-path" requires "--watch".',
    })
  }

  return result
}

const resolveTsconfig = (entry: string): string | true => {
  let directory = path.dirname(entry)

  for (;;) {
    const tsconfig = path.join(directory, 'tsconfig.json')
    if (fs.existsSync(tsconfig)) return tsconfig
    const parent = path.dirname(directory)
    if (parent === directory) return true
    directory = parent
  }
}

const writeBin = (output: string): void => {
  const bin = path.join(output, 'bin.js')
  const content = "#!/usr/bin/env node\nrequire('./index.js')\n"
  fs.writeFileSync(bin, content, { mode: 0o755 })
}

const printError = (error: unknown): void => {
  const message = isSystemError(error)
    ? formatSystemError(error)
    : error instanceof Error
      ? error.message
      : String(error)
  spinner.detail(withErrorTrackingUrl(message, error))
}

const formatDuration = (milliseconds: number): string => {
  if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`
  return `${(milliseconds / 1000).toFixed(2)}s`
}
