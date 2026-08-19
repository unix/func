import { SCAFFOLD, ScaffoldException } from '@func/contracts/scaffold-errors'
import { buildWithRolldown } from './build'
import { funcgoParser } from '../parser'
import { isCommandFailureError, run } from '../utils/command'
import {
  commitDevBundle,
  discardDevBundle,
  prepareDevBundle,
} from '../utils/dev-cache'
import { resolveDevErrorHandler } from '../utils/dev-error-handler-path'
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

  const devErrorHandler = resolveDevErrorHandler()
  const bundle = prepareDevBundle({ cwd, entry })
  let committed = bundle.hit

  try {
    if (!bundle.hit) {
      const result = await buildWithRolldown({
        entry,
        external: [],
        minify: false,
        output: bundle.output,
        report: false,
        sourcemap: 'inline',
      })
      commitDevBundle(bundle, result.files)
      committed = true
    }
    await run(
      process.execPath,
      ['--enable-source-maps', '-r', devErrorHandler, bundle.file, ...args.userArgs],
      {
        cwd,
        env: {
          ...process.env,
          NODE_COMPILE_CACHE: process.env.NODE_COMPILE_CACHE ?? bundle.compileCache,
        },
        shell: false,
        silentFailure: true,
      },
    )
  } catch (error) {
    if (isCommandFailureError(error) && error.silent) {
      process.exitCode = error.exitCode ?? 1
      return
    }

    throw error
  } finally {
    if (!committed) discardDevBundle(bundle)
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
