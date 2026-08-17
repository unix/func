import type { Readable, Writable } from 'node:stream'
import type { CompiledApplication } from './model'
import { Container } from '../runtime/container'
import type { InvocationResult } from '../runtime/container'
import type { Environment } from '../shared/environment'

export interface InvocationOptions {
  cwd?: string
  env?: Environment
  signal?: AbortSignal
  stderr?: Writable
  stdin?: Readable
  stdout?: Writable
}

export const invokeApplication = (
  application: CompiledApplication,
  argv: readonly string[] = [],
  options: InvocationOptions = {},
): Promise<InvocationResult> => {
  return new Container(application, {
    ...options,
    argv,
  }).run()
}
