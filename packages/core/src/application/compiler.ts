import 'reflect-metadata/lite'
import { SYSTEM } from '@func/contracts/core-errors'
import { compileModules } from '../di/module-compiler'
import type { CompiledGraph, CompiledModule } from '../di/module-compiler'
import type { Type } from '../di/types'
import { providerTokenName } from '../di/provider-utils'
import { HandlerRegistry } from '../commands/graph/registry'
import type { HandlerRecord } from '../commands/graph/registry'
import { compileCommandGraph } from '../commands/graph/compiler'
import { compileMethodHandlers } from '../deprecation'
import type { CommandParams } from '../commands/types'
import { compileModuleOptions } from '../options/compiler'
import { isOptionCommand } from '../options/compiler'
import { compileFieldOptions } from '../options/field-metadata'
import { InternalException } from '../shared/errors'
import { ownMetadataValue } from '../shared/metadata-value'
import { metadata } from '../commands/metadata'
import type { handlers } from '../commands/metadata'
import { isBuiltInToken } from '../runtime/injection'
import { moduleMetadata } from './definition'
import type { ModuleInput } from './definition'
import type { CompiledApplication } from './model'
import {
  collectApplicationConfiguration,
  type ApplicationConfiguration,
} from '../shared/application-configuration'

export type RegisteredHandler = HandlerRecord

export const compileApplication = (
  input: Type,
  configurationInput: ApplicationConfiguration = {},
): CompiledApplication => {
  if (typeof input !== 'function') {
    throw new InternalException(SYSTEM.INVALID_MODULE_INPUT, {
      details: { module: '(module config)' },
    })
  }

  const configuration = collectApplicationConfiguration(configurationInput)
  const graph = compileModules(input)
  validateContextProviders(graph)
  const options = compileModuleOptions(graph)
  const records = collectHandlers(graph.modules)
  validateHandlerHosts(
    graph,
    records
      .map(record => record.handler)
      .concat(
        Array.from(options.byModule.values()).flatMap(group =>
          group.flatMap(option => (isOptionCommand(option) ? [option.target] : [])),
        ),
      ),
  )
  const registry = new HandlerRegistry(records)
  const commandGraph = compileCommandGraph({
    options,
    registry,
    root: graph.root,
  })

  return {
    ...(configuration.appName === undefined
      ? {}
      : { appName: configuration.appName }),
    commandGraph,
    graph,
  }
}

const collectHandlers = (modules: readonly CompiledModule[]): RegisteredHandler[] =>
  modules.flatMap(module =>
    commandsFor(module.input).map(handler => compileHandler(handler, module)),
  )

const compileHandler = (handler: Type, owner: CompiledModule): RegisteredHandler => {
  return {
    command: commandMetadata(handler),
    fieldOptions: compileFieldOptions(handler),
    handler,
    kind: handlerKindMetadata(handler),
    methodHandlers: compileMethodHandlers(handler),
    owner,
  }
}

const commandMetadata = (target: Type): CommandParams | undefined => {
  return ownMetadataValue<CommandParams>(metadata.COMMAND_IDENTIFIER, target)
}

const handlerKindMetadata = (target: Type): handlers | undefined => {
  return ownMetadataValue<handlers>(metadata.HANDLER_IDENTIFIER, target)
}

const commandsFor = (input: ModuleInput): Type[] =>
  moduleMetadata(input).commands ?? []

const validateContextProviders = (graph: CompiledGraph) => {
  graph.modules.forEach(module => {
    module.providers.forEach((_record, token) => {
      if (!isBuiltInToken(token)) return
      throw new InternalException(SYSTEM.INVALID_PROVIDER, {
        details: {
          module: module.name,
          token: providerTokenName(token),
        },
      })
    })
  })
}

const validateHandlerHosts = (graph: CompiledGraph, allowed: readonly Type[]) => {
  const hosts = new Set(allowed)
  graph.modules.forEach(module => {
    module.providers.forEach(record => {
      if (!('useClass' in record.definition)) return
      const target = record.definition.useClass
      if (hosts.has(target)) return
      const methodHandlers = compileMethodHandlers(target)
      if (!methodHandlers.length) return

      throw new InternalException(SYSTEM.UNKNOWN_HANDLER, {
        details: {
          handlers: methodHandlers.map(handler => handler.methodName),
          host: target.name || '(anonymous class)',
        },
      })
    })
  })
}
