import 'reflect-metadata/lite'
import { SYSTEM } from '@func/shared/core-errors'
import { CommandCatalog } from '../context'
import { compileModules } from '../di/compiler'
import type { CompiledGraph, CompiledModule } from '../di/compiler'
import type { Type } from '../di/provider'
import { providerTokenName } from '../di/provider-utils'
import { HandlerRegistry } from '../containers/handler-registry'
import type { HandlerRecord } from '../containers/handler-registry'
import { CommandGraph } from '../containers/command-graph'
import { compileMethodHandlers } from '../deprecation'
import type { CommandParams } from '../interfaces'
import { compileModuleOptions } from '../options/compiler'
import { isOptionCommand } from '../options/compiler'
import { compileFieldOptions } from '../options/field-metadata'
import { InternalException } from '../shared/errors'
import { metadata } from '../utils/metadata'
import type { handlers } from '../utils/metadata'
import { isBuiltInToken } from '../injection'
import { moduleMetadata } from './module-definition'
import type { ModuleInput } from './module-definition'
import { validateApplicationResources } from './resources'

export type RegisteredHandler = HandlerRecord

export interface CompiledApplication {
  commandCatalog: CommandCatalog
  commandGraph: CommandGraph
  graph: CompiledGraph
}

export const compileApplication = (input: Type): CompiledApplication => {
  if (typeof input !== 'function') {
    throw new InternalException(SYSTEM.INVALID_MODULE_INPUT, {
      details: { module: '(module config)' },
      message: 'The application root must be a class decorated with @Module.',
    })
  }

  const graph = compileModules(input)
  validateApplicationResources(graph)
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
  const commandGraph = new CommandGraph({
    options,
    registry,
    root: graph.root,
  })
  const commandCatalog = new CommandCatalog(commandGraph.commands())

  return {
    commandCatalog,
    commandGraph,
    graph,
  }
}

const collectHandlers = (modules: readonly CompiledModule[]): RegisteredHandler[] =>
  modules.flatMap(module =>
    commandsFor(module.input).map(handler => compileHandler(handler, module)),
  )

const compileHandler = (
  handler: Type,
  owner: CompiledModule,
): RegisteredHandler => ({
  command: Reflect.getOwnMetadata(metadata.COMMAND_IDENTIFIER, handler) as
    CommandParams | undefined,
  fieldOptions: compileFieldOptions(handler),
  handler,
  kind: Reflect.getOwnMetadata(metadata.HANDLER_IDENTIFIER, handler) as
    handlers | undefined,
  methodHandlers: compileMethodHandlers(handler),
  owner,
})

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
        message: `System provider "${providerTokenName(token)}" can only be configured through application options.`,
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
        message: `@Handler methods must belong to a @Command or @OptionCommand class.`,
      })
    })
  })
}
