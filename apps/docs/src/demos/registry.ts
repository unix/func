import type { Type } from '../../../../packages/core/src'
import { createInvoker } from '../../../../packages/core/src/subpath/invoke'
import type { TerminalDemoId } from './protocol'
import { Readable, Writable } from './runtime/terminal-stream'

interface TerminalDemoDefinition {
  executable: string
  input: () => Promise<Type>
}

const terminalDemos: Record<TerminalDemoId, TerminalDemoDefinition> = {
  'errors-local-catch': {
    executable: 'ship',
    input: async () =>
      (await import('./fixtures/errors-local-catch.demo')).ErrorsLocalCatchModule,
  },
  'guide-help': {
    executable: 'ship',
    input: async () => (await import('./fixtures/guide-help.demo')).GuideHelpModule,
  },
  'guide-status': {
    executable: 'ship',
    input: async () =>
      (await import('./fixtures/guide-status.demo')).GuideStatusModule,
  },
  'json-output': {
    executable: 'ship',
    input: async () =>
      (await import('./fixtures/json-output.demo')).JsonOutputDemoModule,
  },
  'saas-status': {
    executable: 'saas',
    input: async () =>
      (await import('./fixtures/saas-status.demo')).SaasStatusModule,
  },
  'use-cases': {
    executable: 'ship',
    input: async () => (await import('./fixtures/use-cases.demo')).UseCasesModule,
  },
}

const terminalDemoInput = new Readable()

const terminalDemoOutput = (stream: 'stderr' | 'stdout') =>
  new Writable({
    write(chunk: string | Uint8Array, _encoding, callback) {
      const text =
        typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
      console[stream === 'stderr' ? 'error' : 'log'](text.replace(/\n$/, ''))
      callback()
    },
  })

const terminalDemoArgv = (command: string, executable: string) => {
  const argv = command.trim().split(/\s+/).filter(Boolean)
  const executableIndex = argv.indexOf(executable)
  if (executableIndex >= 0) return argv.slice(executableIndex + 1)
  const packageManager = argv[0]
  const usesRunSubcommand =
    (packageManager === 'bun' || packageManager === 'npm') && argv[1] === 'run'
  const scriptArguments = argv.slice(usesRunSubcommand ? 3 : 2)
  if (usesRunSubcommand || packageManager === 'pnpm' || packageManager === 'yarn') {
    if (scriptArguments[0] === '--') return scriptArguments.slice(1)
    return scriptArguments
  }

  const passthroughIndex = argv.indexOf('--')
  if (passthroughIndex >= 0) return argv.slice(passthroughIndex + 1)
  return argv
}

export const runTerminalDemo = async (demoId: TerminalDemoId, command: string) => {
  const demo = terminalDemos[demoId]
  const argv = terminalDemoArgv(command, demo.executable)
  await createInvoker(await demo.input()).invoke(argv, {
    cwd: '/',
    env: {},
    stderr: terminalDemoOutput('stderr'),
    stdin: terminalDemoInput,
    stdout: terminalDemoOutput('stdout'),
  })
}
