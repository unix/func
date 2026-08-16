import {
  RUNTIME as CONFIG_RUNTIME,
  SYSTEM as CONFIG_SYSTEM,
} from '@func/contracts/config-errors'
import { RUNTIME, RUNTIME_PRINT, SYSTEM } from '@func/contracts/core-errors'
import {
  RUNTIME as LOG_RUNTIME,
  SYSTEM as LOG_SYSTEM,
} from '@func/contracts/log-errors'
import { ErrorScope, Module, formatExceptionCode } from '../src'
import type { ModuleMetadata, Type } from '../src'
import { createInvoker } from '../src/subpath/invoke'
import type { InvocationOptions, InvocationResult } from '../src/subpath/invoke'
import { expect, test as baseTest } from 'vitest'
import { random } from './_utils'

interface Fixtures {
  runContainer: (argv: string[], handlers: Type[]) => Promise<void>
  setArgv: (argv: string[]) => void
}

interface RunOptions extends InvocationOptions {
  argv?: readonly string[]
}

const testModule = (params: ModuleMetadata): Type => {
  @Module(params)
  class TestModule {}

  return TestModule
}

const test = baseTest.extend<Fixtures>({
  setArgv: async ({}, use) => {
    const original = process.argv

    await use(argv => {
      process.argv = argv
    })

    process.argv = original
  },
  runContainer: async ({ setArgv }, use) => {
    await use(async (argv, handlers) => {
      setArgv(argv)
      await run(testModule({ commands: handlers }))
    })
  },
})

const run = async (
  input: Type,
  options: RunOptions = {},
): Promise<InvocationResult> => {
  const { argv = process.argv.slice(2), ...invocationOptions } = options
  try {
    const result = await createInvoker(input).invoke(argv, invocationOptions)
    process.exitCode = result.exitCode
    return result
  } catch (error) {
    process.exitCode = 1
    throw error
  }
}

const configRuntimeErrorCode = (code: CONFIG_RUNTIME) =>
  formatExceptionCode(ErrorScope.RUNTIME, code)

const configSystemErrorCode = (code: CONFIG_SYSTEM) =>
  formatExceptionCode(ErrorScope.SYSTEM, code)

const logRuntimeErrorCode = (code: LOG_RUNTIME) =>
  formatExceptionCode(ErrorScope.RUNTIME, code)

const logSystemErrorCode = (code: LOG_SYSTEM) =>
  formatExceptionCode(ErrorScope.SYSTEM, code)

const runtimeErrorCode = (code: RUNTIME) =>
  formatExceptionCode(ErrorScope.RUNTIME, code)

const runtimePrintErrorCode = (code: RUNTIME_PRINT) =>
  formatExceptionCode(ErrorScope.RUNTIME_PRINT, code)

const systemErrorCode = (code: SYSTEM) =>
  formatExceptionCode(ErrorScope.SYSTEM, code)

export {
  CONFIG_RUNTIME,
  CONFIG_SYSTEM,
  LOG_RUNTIME,
  LOG_SYSTEM,
  RUNTIME,
  RUNTIME_PRINT,
  SYSTEM,
  configRuntimeErrorCode,
  configSystemErrorCode,
  expect,
  logRuntimeErrorCode,
  logSystemErrorCode,
  random,
  run,
  runtimeErrorCode,
  runtimePrintErrorCode,
  systemErrorCode,
  test,
  testModule,
}
