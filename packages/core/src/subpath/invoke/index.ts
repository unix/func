import 'reflect-metadata/lite'
import { compileApplication } from '../../application/compiler'
import { invokeApplication } from '../../application/invocation'
import type { InvocationOptions } from '../../application/invocation'
import type { CompiledApplication } from '../../application/model'
import type { Type } from '../../di/types'
import type { InvocationResult } from '../../runtime/container'

export type { InvocationOptions, InvocationResult }

export interface Invoker {
  invoke(
    argv?: readonly string[],
    options?: InvocationOptions,
  ): Promise<InvocationResult>
}

class ApplicationInvoker implements Invoker {
  constructor(private readonly application: CompiledApplication) {}

  invoke(
    argv: readonly string[] = [],
    options: InvocationOptions = {},
  ): Promise<InvocationResult> {
    return invokeApplication(this.application, argv, options)
  }
}

export const createInvoker = (input: Type): Invoker => {
  return new ApplicationInvoker(compileApplication(input))
}
