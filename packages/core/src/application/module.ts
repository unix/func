import 'reflect-metadata'
import { Container } from '../containers/container'
import type { ContainerOptions } from '../containers/container'
import { metadata } from '../utils/metadata'
import {
  FuncModuleInput,
  FuncModuleParams,
  ResolvedModule,
} from './interfaces'

export const FuncModule =
  (params: FuncModuleParams): ClassDecorator =>
  target => {
    Reflect.defineMetadata(metadata.FUNC_MODULE_IDENTIFIER, Object.assign({}, params), target)
  }

export const createApp = (
  input: FuncModuleInput,
  options: ContainerOptions = {},
): Container => {
  const params = resolveModule(input)

  return new Container(params.commands, Object.assign({}, options, { services: params.services }))
}

export const run = async (
  input: FuncModuleInput,
  options: ContainerOptions = {},
): Promise<void> => {
  await createApp(input, options).run()
}

const resolveModule = (input: FuncModuleInput): ResolvedModule => {
  const params = isModuleClass(input)
    ? Reflect.getMetadata(metadata.FUNC_MODULE_IDENTIFIER, input)
    : input

  if (!params) {
    return {
      commands: [input as new (...args: any[]) => any],
      services: [],
    }
  }

  const imports = (params.imports || []).map((item: FuncModuleInput) => resolveModule(item))
  const commands = imports.flatMap(item => item.commands).concat(params.commands || [])
  const services = imports.flatMap(item => item.services).concat(params.services || [])

  return { commands, services }
}

const isModuleClass = (input: FuncModuleInput): input is new (...args: any[]) => any => {
  return typeof input === 'function'
}
