import { Container } from '../containers/container'
import type { ContainerOptions, InvocationResult } from '../containers/container'
import type { Type } from '../di/provider'
import { compileApplication } from './module-compiler'

export const createApp = (
  input: Type,
  options: ContainerOptions = {},
): Container => {
  return new Container(compileApplication(input), options)
}

export const run = async (
  input: Type,
  options: ContainerOptions = {},
): Promise<InvocationResult> => {
  try {
    const result = await createApp(input, options).run()
    process.exitCode = result.exitCode
    return result
  } catch (error) {
    process.exitCode = 1
    throw error
  }
}
