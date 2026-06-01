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

  spinner.start('validating...')
  const pkg = readPackage()
  const entry = resolveEntry(args.file)
  if (!entry) {
    throw new Error(`About. Not found entry. Run "funcgo setup" for suggestions.`)
  }

  const output = path.resolve(cwd, args.out || pkg.func?.outDir || 'dist')
  spinner.succeed()

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
}

const resolveNccCli = (): string => {
  return require.resolve('@vercel/ncc/dist/ncc/cli.js')
}
