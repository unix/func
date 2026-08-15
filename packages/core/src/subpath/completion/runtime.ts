import { run } from '../../application/module'
import type { InvocationResult } from '../../containers/container'
import type { Type } from '../../di/provider'
import { complete } from './engine'
import type { CompletionRunOptions, CompletionShell } from './interfaces'
import {
  completionEnvironmentVariable,
  completionSource,
  formatCompletionResult,
} from './source'

interface CompletionMode {
  readonly operation: 'complete' | 'source'
  readonly shell: CompletionShell
}

export const runWithCompletion = async (
  input: Type,
  options: CompletionRunOptions,
): Promise<InvocationResult> => {
  const { name, ...containerOptions } = options
  const environment = completionEnvironmentVariable(name)
  const value = process.env[environment]
  if (!value) return run(input, containerOptions)

  try {
    const mode = parseMode(value)
    if (mode.operation === 'source') {
      const source = completionSource(name, mode.shell)
      const stdout = containerOptions.stdout ?? process.stdout
      stdout.write(source)
      process.exitCode = 0
      return { exitCode: 0, result: source }
    }

    const argv = containerOptions.argv ?? process.argv.slice(2)
    const result = complete(input, {
      args: argv.slice(0, -1),
      incomplete: argv.at(-1) ?? '',
    })
    const stdout = containerOptions.stdout ?? process.stdout
    stdout.write(formatCompletionResult(result, mode.shell))
    process.exitCode = 0
    return { exitCode: 0, result }
  } catch (error) {
    process.exitCode = 1
    throw error
  }
}

const parseMode = (value: string): CompletionMode => {
  const match = /^(bash|fish|powershell|zsh)_(complete|source)$/.exec(value)
  if (!match) throw new TypeError(`Unsupported completion mode "${value}".`)
  const operation = match[2]
  const shell = match[1]
  if (!isOperation(operation) || !isShell(shell))
    throw new TypeError(`Unsupported completion mode "${value}".`)
  return {
    operation,
    shell,
  }
}

const isOperation = (
  value: string | undefined,
): value is CompletionMode['operation'] => value === 'complete' || value === 'source'

const isShell = (value: string | undefined): value is CompletionShell =>
  value === 'bash' || value === 'fish' || value === 'powershell' || value === 'zsh'
