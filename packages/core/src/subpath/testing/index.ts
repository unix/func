import 'reflect-metadata/lite'
import { Readable, Writable } from 'node:stream'
import { compileApplication } from '../../application/module-compiler'
import type { CompiledApplication } from '../../application/module-compiler'
import { applyProviderOverrides } from '../../application/provider-overrides'
import type { ProviderOverride } from '../../application/provider-overrides'
import { Container } from '../../containers/container'
import type { Type } from '../../di/provider'

export type {
  ModuleProviderOverride,
  ProviderOverride,
} from '../../application/provider-overrides'

export interface TestingAppOptions {
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
    const container = new Container(this.application, {
      argv: [...argv],
      cwd: options.cwd,
      signal: options.signal,
      stderr: stderr.stream,
      stdin: Readable.from([options.stdin ?? '']),
      stdout: stdout.stream,
    })
    let exitCode: number
    let error: Error | undefined
    let result: unknown

    try {
      const invocation = await container.run()
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
  const application = compileApplication(input)
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
