import arg from 'arg'
import { run } from '../utils/command'
import * as spinner from '../utils/spinner'
import { cwd, resolveEntry } from '../utils/paths'

interface DevArgs {
  file?: string
  userArgs: string[]
}

export const dev = async (argv: string[]): Promise<void> => {
  const args = parseDevArgs(argv)

  spinner.start('validating...')
  const entry = resolveEntry(args.file)
  if (!entry) {
    throw new Error(`About. Not found entry. Run "funcgo setup" for suggestions.`)
  }

  const tsNodeRegister = resolveTsNodeRegister()
  spinner.succeed(true)

  await run('node', ['-r', tsNodeRegister, entry, ...args.userArgs], { cwd })
}

export const parseDevArgs = (argv: string[]): DevArgs => {
  const delimiter = argv.indexOf('--')
  const ownArgs = delimiter >= 0 ? argv.slice(0, delimiter) : argv
  const userArgs = delimiter >= 0 ? argv.slice(delimiter + 1) : []
  const args = arg(
    {
      '--file': String,
      '-f': '--file',
    },
    {
      argv: ownArgs,
      permissive: true,
    },
  )

  return {
    file: args['--file'],
    userArgs: delimiter >= 0 ? userArgs : args._,
  }
}

const resolveTsNodeRegister = (): string => {
  try {
    return require.resolve('ts-node/register', { paths: [cwd] })
  } catch (error) {
    return require.resolve('ts-node/register')
  }
}
