import { SCAFFOLD, ScaffoldException } from '@func/contracts/scaffold-errors'
import { funcgoParser } from '../parser'
import { isCommandFailureError, run } from '../utils/command'
import { cwd, resolveEntry } from '../utils/paths'

export interface DevArgs {
  file?: string
  userArgs: string[]
}

export const dev = async (input: string[] | DevArgs): Promise<void> => {
  const args = Array.isArray(input) ? parseDevArgs(input) : input
  const entry = resolveEntry(args.file)
  if (!entry) {
    throw new ScaffoldException(SCAFFOLD.ENTRY_NOT_FOUND, {
      details: { entry: args.file },
      message: 'About. Not found entry. Run "funcgo setup" for suggestions.',
    })
  }

  const tsNodeRegister = resolveTsNodeRegister()
  const devErrorHandler = resolveDevErrorHandler()

  try {
    await run(
      'node',
      ['-r', tsNodeRegister, '-r', devErrorHandler, entry, ...args.userArgs],
      {
        cwd,
        silentFailure: true,
      },
    )
  } catch (error) {
    if (isCommandFailureError(error) && error.silent) {
      process.exitCode = error.exitCode ?? 1
      return
    }

    throw error
  }
}

export const parseDevArgs = (argv: string[]): DevArgs => {
  const parsed = funcgoParser.parse(['dev', ...argv])
  if (parsed.command !== 'dev') {
    throw new ScaffoldException(SCAFFOLD.INTERNAL_COMMAND_MISMATCH, {
      details: { actual: parsed.command, expected: 'dev' },
      message: 'Expected dev command.',
    })
  }

  return {
    file: parsed.options.file,
    userArgs: parsed.inputs.slice(),
  }
}

const resolveTsNodeRegister = (): string => {
  try {
    return require.resolve('ts-node/register', { paths: [cwd] })
  } catch {
    return require.resolve('ts-node/register')
  }
}

export const resolveDevErrorHandler = (): string => {
  return require.resolve('../utils/dev-error-handler')
}
