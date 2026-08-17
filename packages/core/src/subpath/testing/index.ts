import 'reflect-metadata/lite'
import { Readable, Writable } from 'node:stream'
import { compileApplication } from '../../application/compiler'
import { invokeApplication } from '../../application/invocation'
import type { CompiledApplication } from '../../application/model'
import { applyProviderOverrides } from './provider-overrides'
import type { ProviderOverride } from './provider-overrides'
import type { Type } from '../../di/types'
import type { ApplicationConfiguration } from '../../shared/application-configuration'
import type { Environment } from '../../shared/environment'

export type { ModuleProviderOverride, ProviderOverride } from './provider-overrides'

export interface TestingAppOptions extends ApplicationConfiguration {
  overrides?: ProviderOverride[]
}

export interface TestingInvocationResult {
  readonly exitCode: number
  readonly error: Error | undefined
  readonly result: unknown
  readonly stderr: string
  readonly stdout: string
}

export interface TestingApp {
  invoke(
    argv?: readonly string[],
    options?: TestingInvocationOptions,
  ): Promise<TestingInvocationResult>
}

export interface TestingInvocationOptions {
  cwd?: string
  env?: Environment
  signal?: AbortSignal
  stdin?: string
}

class TestingApplication implements TestingApp {
  constructor(private readonly application: CompiledApplication) {}

  async invoke(
    argv: readonly string[] = [],
    options: TestingInvocationOptions = {},
  ): Promise<TestingInvocationResult> {
    const stderr = createCapturedOutput()
    const stdout = createCapturedOutput()
    const invocationOptions = {
      cwd: options.cwd,
      env: options.env ?? {},
      signal: options.signal,
      stderr: stderr.stream,
      stdin: Readable.from([options.stdin ?? '']),
      stdout: stdout.stream,
    }
    let exitCode: number
    let error: Error | undefined
    let result: unknown

    try {
      const invocation = await invokeApplication(
        this.application,
        argv,
        invocationOptions,
      )
      exitCode = invocation.exitCode
      result = invocation.result
    } catch (cause) {
      exitCode = 1
      error = cause instanceof Error ? cause : new Error(String(cause))
    }

    return {
      exitCode,
      error,
      result,
      stderr: stderr.text(),
      stdout: stdout.text(),
    }
  }
}

export const createTestingApp = (
  input: Type,
  options: TestingAppOptions = {},
): TestingApp => {
  const application = compileApplication(input, options)
  const overrides = options.overrides ?? []
  if (overrides.length) applyProviderOverrides(application, overrides)
  return new TestingApplication(application)
}

interface CapturedOutput {
  stream: Writable
  text(): string
}

const createCapturedOutput = (): CapturedOutput => {
  const chunks: Buffer[] = []
  const stream = new Writable({
    write(
      chunk: string | Uint8Array,
      _encoding: BufferEncoding,
      callback: (error?: Error | null) => void,
    ) {
      chunks.push(Buffer.from(chunk))
      callback()
    },
  })

  return {
    stream,
    text: () => Buffer.concat(chunks).toString('utf8'),
  }
}
