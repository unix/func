import { SYSTEM } from '@func/contracts/core-errors'
import type { ApplicationFeature } from '../../application/features'
import { defineApplicationFeature } from '../../application/features'
import { completeGraph } from './engine'
import type { CompletionFeatureOptions, CompletionShell } from './interfaces'
import {
  completionEnvironmentVariable,
  completionSource,
  formatCompletionResult,
} from './source'
import { InternalException } from '../../shared/errors'

interface CompletionMode {
  readonly operation: 'complete' | 'source'
  readonly shell: CompletionShell
}

const completionModes = new Map<string, CompletionMode>([
  ['bash_complete', { operation: 'complete', shell: 'bash' }],
  ['bash_source', { operation: 'source', shell: 'bash' }],
  ['elvish_complete', { operation: 'complete', shell: 'elvish' }],
  ['elvish_source', { operation: 'source', shell: 'elvish' }],
  ['fish_complete', { operation: 'complete', shell: 'fish' }],
  ['fish_source', { operation: 'source', shell: 'fish' }],
  ['nushell_complete', { operation: 'complete', shell: 'nushell' }],
  ['nushell_source', { operation: 'source', shell: 'nushell' }],
  ['powershell_complete', { operation: 'complete', shell: 'powershell' }],
  ['powershell_source', { operation: 'source', shell: 'powershell' }],
  ['zsh_complete', { operation: 'complete', shell: 'zsh' }],
  ['zsh_source', { operation: 'source', shell: 'zsh' }],
])

export const withCompletion = (
  options: CompletionFeatureOptions,
): ApplicationFeature => {
  const { bin } = options
  const environment = completionEnvironmentVariable(bin)

  return defineApplicationFeature({
    key: 'completion',
    bootstrap: context => {
      const value = context.env[environment]
      if (!value) return
      const mode = parseMode(value)
      if (mode.operation === 'source') {
        context.stdout.write(completionSource(bin, mode.shell))
        return { exitCode: 0 }
      }

      const result = completeGraph(context.application.commandGraph, {
        args: context.argv.slice(0, -1),
        incomplete: context.argv.at(-1) ?? '',
      })
      context.stdout.write(formatCompletionResult(result, mode.shell))
      return { exitCode: 0 }
    },
  })
}

const parseMode = (value: string): CompletionMode => {
  const mode = completionModes.get(value)
  if (mode) return mode
  throw new InternalException(SYSTEM.INVALID_COMPLETION_MODE, {
    details: { mode: value },
  })
}
