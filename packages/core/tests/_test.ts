import {
  RUNTIME as CONFIG_RUNTIME,
  SYSTEM as CONFIG_SYSTEM,
} from '@func/shared/config-errors'
import { RUNTIME, RUNTIME_PRINT, SYSTEM } from '@func/shared/core-errors'
import {
  RUNTIME as LOG_RUNTIME,
  SYSTEM as LOG_SYSTEM,
} from '@func/shared/log-errors'
import { ErrorScope, Module, formatExceptionCode } from '../src'
import { expect, test as baseTest } from 'vitest'
import { createApp } from '../src'
import type { Container, ModuleMetadata, Type } from '../src'
import { random } from './_utils'

interface Fixtures {
  runContainer: (argv: string[], handlers: Type[]) => Promise<Container>
  setArgv: (argv: string[]) => void
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
      const container = createApp(testModule({ commands: handlers }))
      await container.run()
      return container
    })
  },
})

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
  runtimeErrorCode,
  runtimePrintErrorCode,
  systemErrorCode,
  test,
  testModule,
}
