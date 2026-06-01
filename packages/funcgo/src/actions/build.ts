import fs from 'fs'
import path from 'path'
import arg from 'arg'
import { run } from '../utils/command'
import * as spinner from '../utils/spinner'
import { cwd, readPackage, resolveEntry } from '../utils/paths'

export interface BuildArgs {
  file?: string
  out?: string
  external: string[]
}

export const build = async (argv: string[]): Promise<void> => {
  const args = parseBuildArgs(argv)

  let entry: string
  let output: string
  try {
    const pkg = readPackage()
    const resolvedEntry = resolveEntry(args.file)
    if (!resolvedEntry) {
      throw new Error(`About. Not found entry. Run "funcgo setup" for suggestions.`)
    }

    entry = resolvedEntry
    output = path.resolve(cwd, args.out || pkg.func?.outDir || 'dist')
  } catch (error) {
    spinner.succeed(true)
    throw error
  }

  await buildWithNcc({
    entry,
    external: args.external,
    ncc: process.execPath,
    nccArgs: [resolveNccCli()],
    output,
  })
}

export const parseBuildArgs = (argv: string[]): BuildArgs => {
  const args = arg(
    {
      '--file': String,
      '--out': String,
      '--external': [String],
      '-f': '--file',
      '-o': '--out',
      '-e': '--external',
    },
    {
      argv,
    },
  )

  return {
    file: args['--file'],
    out: args['--out'],
    external: args['--external'] || [],
  }
}

interface BuildWithNccOptions {
  entry: string
  external: string[]
  ncc: string
  nccArgs?: string[]
  output: string
}

export const buildWithNcc = async (options: BuildWithNccOptions): Promise<void> => {
  spinner.start('bundling...')
  try {
    const externalArgs = options.external.flatMap(item => ['-e', item])

    await run(
      options.ncc,
      [
        ...(options.nccArgs || []),
        '-m',
        'build',
        options.entry,
        '-o',
        options.output,
        ...externalArgs,
      ],
      { cwd },
    )
    const bin = path.join(options.output, 'bin.js')
    const content = "#!/usr/bin/env node\nrequire('./index.js')\n"
    fs.writeFileSync(bin, content, { mode: 0o755 })
    spinner.succeed()
  } catch (error) {
    spinner.succeed(true)
    throw error
  }
}

const resolveNccCli = (): string => {
  return require.resolve('@vercel/ncc/dist/ncc/cli.js')
}
