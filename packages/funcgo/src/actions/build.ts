import fs from 'fs'
import path from 'path'
import arg from 'arg'
import { valueTypeValidationPlugin } from '../plugins/value-type-validation'
import { run } from '../utils/command'
import { resolveWatchTargets, watchBuild } from '../utils/build-watch'
import { withErrorTrackingUrl } from '../utils/error-tracking'
import * as spinner from '../utils/spinner'
import { cwd, readPackage, resolveEntry } from '../utils/paths'

export interface BuildArgs {
  file?: string
  out?: string
  external: string[]
  watch: boolean
  watchPaths: string[]
}

export const build = async (argv: string[]): Promise<void> => {
  await runBuild(argv, buildWithRolldown)
}

export const buildNcc = async (argv: string[]): Promise<void> => {
  const ncc = process.execPath
  const nccArgs = [resolveNccCli()]

  await runBuild(argv, options =>
    buildWithNcc({
      ...options,
      ncc,
      nccArgs,
    }),
  )
}

interface ProjectBuildOptions {
  entry: string
  external: string[]
  output: string
}

type ProjectBuild = (options: ProjectBuildOptions) => Promise<void>

const runBuild = async (
  argv: string[],
  projectBuild: ProjectBuild,
): Promise<void> => {
  const args = parseBuildArgs(argv)
  const pkg = readPackage()
  const entry = resolveEntry(args.file)
  if (!entry) {
    throw new Error(`About. Not found entry. Run "funcgo setup" for suggestions.`)
  }
  const output = path.resolve(cwd, args.out ?? pkg.func?.outDir ?? 'dist')

  const buildOptions = {
    entry,
    external: args.external,
    output,
  }
  if (!args.watch) {
    await projectBuild(buildOptions)
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
        await projectBuild(buildOptions)
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
    await bundle({
      input: options.entry,
      external: options.external,
      platform: 'node',
      plugins: [valueTypeValidationPlugin({ cwd })],
      tsconfig: resolveTsconfig(options.entry),
      transform: {
        target: 'node20.19',
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
  const args = arg(
    {
      '--file': String,
      '--out': String,
      '--external': [String],
      '--watch': Boolean,
      '--watch-path': [String],
      '-f': '--file',
      '-o': '--out',
      '-e': '--external',
      '-w': '--watch',
    },
    {
      argv,
    },
  )

  const result = {
    file: args['--file'],
    out: args['--out'],
    external: args['--external'] ?? [],
    watch: Boolean(args['--watch']),
    watchPaths: args['--watch-path'] ?? [],
  }
  if (result.watchPaths.length && !result.watch) {
    throw new Error(`Option "--watch-path" requires "--watch".`)
  }

  return result
}

interface BuildWithNccOptions extends ProjectBuildOptions {
  ncc: string
  nccArgs?: string[]
}

export const buildWithNcc = async (options: BuildWithNccOptions): Promise<void> => {
  const startedAt = performance.now()
  spinner.start('Bundling...')
  try {
    const externalArgs = options.external.flatMap(item => ['-e', item])

    await run(
      options.ncc,
      [
        ...(options.nccArgs ?? []),
        '-m',
        'build',
        options.entry,
        '-o',
        options.output,
        ...externalArgs,
      ],
      { cwd },
    )
    writeBin(options.output)
    spinner.succeed(`Bundled in ${formatDuration(performance.now() - startedAt)}`)
  } catch (error) {
    spinner.fail('Build failed')
    throw error
  }
}

const resolveNccCli = (): string => {
  return require.resolve('@vercel/ncc/dist/ncc/cli.js')
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
  const message = error instanceof Error ? error.message : String(error)
  spinner.detail(withErrorTrackingUrl(message, error))
}

const formatDuration = (milliseconds: number): string => {
  if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`
  return `${(milliseconds / 1000).toFixed(2)}s`
}
