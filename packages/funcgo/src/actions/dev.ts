import arg from 'arg'
import {
  isCommandFailureError,
  run,
} from '../utils/command'
import { cwd, resolveEntry } from '../utils/paths'

interface DevArgs {
  file?: string
  userArgs: string[]
}

export const dev = async (argv: string[]): Promise<void> => {
  const args = parseDevArgs(argv)

  const entry = resolveEntry(args.file)
  if (!entry) {
    throw new Error(`About. Not found entry. Run "funcgo setup" for suggestions.`)
  }

  const tsNodeRegister = resolveTsNodeRegister()
  const devErrorHandler = resolveDevErrorHandler()

  try {
    await run('node', ['-r', tsNodeRegister, '-r', devErrorHandler, entry, ...args.userArgs], {
      cwd,
      silentFailure: true,
    })
  } catch (error) {
    if (isCommandFailureError(error) && error.silent) {
      process.exitCode = error.code || 1
      return
    }

    throw error
  }
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

export const resolveDevErrorHandler = (): string => {
  return require.resolve('../utils/dev-error-handler')
}
