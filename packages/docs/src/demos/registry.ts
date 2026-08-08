import { run, type FuncModuleInput } from '../../../core/src'
import { ErrorsLocalCatchModule } from './fixtures/errors-local-catch.demo'
import { GuideHelpModule } from './fixtures/guide-help.demo'
import { GuideStatusModule } from './fixtures/guide-status.demo'
import { SaasStatusModule } from './fixtures/saas-status.demo'
import { UseCasesModule } from './fixtures/use-cases.demo'
import type { TerminalDemoId } from './protocol'

interface TerminalDemoDefinition {
  executable: string
  input: FuncModuleInput
}

const terminalDemos: Record<TerminalDemoId, TerminalDemoDefinition> = {
  'errors-local-catch': {
    executable: 'ship',
    input: ErrorsLocalCatchModule,
  },
  'guide-help': {
    executable: 'ship',
    input: GuideHelpModule,
  },
  'guide-status': {
    executable: 'ship',
    input: GuideStatusModule,
  },
  'saas-status': {
    executable: 'saas',
    input: SaasStatusModule,
  },
  'use-cases': {
    executable: 'ship',
    input: UseCasesModule,
  },
}

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
  await run(demo.input, { argv })
}
