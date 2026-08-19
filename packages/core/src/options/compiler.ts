import { SYSTEM } from '@func/contracts/core-errors'
import { moduleMetadata } from '../application/definition'
import { compileMethodHandlers } from '../deprecation'
import type {
  CompiledGraph,
  CompiledModule,
  ProviderRecord,
} from '../di/module-compiler'
import { registerProviders } from '../di/module-compiler'
import type { Type } from '../di/types'
import type { HandlerParams } from '../commands/types'
import { InternalException } from '../shared/errors'
import { metadataValue } from '../shared/metadata-value'
import { metadata } from './metadata'
import { compileFieldOptions } from './field-metadata'
import type { CompiledFieldOption } from './field-metadata'
import type { OptionCommandParams } from './types'

interface CompiledOptionBase {
  owner: CompiledModule
  record: ProviderRecord
  target: Type
}

export interface CompiledOptionProvider extends CompiledOptionBase {
  fieldOptions: CompiledFieldOption[]
  kind: 'value'
}

export interface CompiledOptionCommand extends CompiledOptionBase {
  handler: HandlerParams
  kind: 'action'
  option: OptionCommandParams
}

export type CompiledModuleOption = CompiledOptionCommand | CompiledOptionProvider

export interface CompiledModuleOptions {
  byModule: ReadonlyMap<CompiledModule, readonly CompiledModuleOption[]>
  root: readonly CompiledModuleOption[]
}

export const compileModuleOptions = (
  graph: CompiledGraph,
): CompiledModuleOptions => {
  const byModule = new Map<CompiledModule, readonly CompiledModuleOption[]>()
  const owners = new Map<Type, CompiledModule>()

  graph.modules.forEach(module => {
    const targets = optionsFor(module)
    targets.forEach(target => validateOptionTarget(target, module))
    const records = registerProviders(module, targets, 'option')
    const options = targets.map((target, index) => {
      const existing = owners.get(target)
      if (existing) {
        throw new InternalException(SYSTEM.DUPLICATE_PROVIDER, {
          details: {
            modules: [existing.name, module.name],
            token: target.name || '(anonymous class)',
          },
        })
      }
      owners.set(target, module)
      return compileModuleOption(target, module, records[index])
    })
    byModule.set(module, options)
  })

  return {
    byModule,
    root: byModule.get(graph.root) ?? [],
  }
}

export const optionsForModule = (
  compiled: CompiledModuleOptions,
  module: CompiledModule,
): readonly CompiledModuleOption[] => compiled.byModule.get(module) ?? []

export const isOptionProvider = (
  option: CompiledModuleOption,
): option is CompiledOptionProvider => option.kind === 'value'

export const isOptionCommand = (
  option: CompiledModuleOption,
): option is CompiledOptionCommand => option.kind === 'action'

const optionsFor = (module: CompiledModule): Type[] => {
  const options = moduleMetadata(module.input).options ?? []
  if (options.every(option => typeof option === 'function')) return options
  const invalid = options.find(option => typeof option !== 'function')
  throw new InternalException(SYSTEM.INVALID_OPTION_DECLARATION, {
    details: {
      module: module.name,
      option: invalid,
      reason: 'invalid-module-option',
    },
  })
}

const validateOptionTarget = (target: Type, module: CompiledModule) => {
  const value: unknown = Reflect.getOwnMetadata(metadata.OPTION_IDENTIFIER, target)
  const action = optionCommandMetadata(target)
  if ((value === true && !action) || (value !== true && action)) return

  throw new InternalException(SYSTEM.INVALID_OPTION_DECLARATION, {
    details: {
      module: module.name,
      option: target.name || '(anonymous class)',
      reason:
        value === true && action
          ? 'multiple-option-kinds'
          : 'missing-option-decorator',
    },
  })
}

const compileModuleOption = (
  target: Type,
  owner: CompiledModule,
  record: ProviderRecord,
): CompiledModuleOption => {
  const option = optionCommandMetadata(target)
  const fieldOptions = compileFieldOptions(target)
  const methodHandlers = compileMethodHandlers(target)

  if (option) {
    validateOptionCommand(target, fieldOptions, methodHandlers)
    return {
      handler: methodHandlers[0],
      kind: 'action',
      option,
      owner,
      record,
      target,
    }
  }

  if (methodHandlers.length) {
    throw new InternalException(SYSTEM.INVALID_OPTION_DECLARATION, {
      details: {
        handlers: methodHandlers.map(handler => handler.methodName),
        option: target.name || '(anonymous class)',
        reason: 'option-has-handlers',
      },
    })
  }
  if (!fieldOptions.length) {
    throw new InternalException(SYSTEM.INVALID_OPTION_DECLARATION, {
      details: {
        option: target.name || '(anonymous class)',
        reason: 'option-has-no-fields',
      },
    })
  }

  return {
    fieldOptions,
    kind: 'value',
    owner,
    record,
    target,
  }
}

const optionCommandMetadata = (target: Type): OptionCommandParams | undefined => {
  return metadataValue<OptionCommandParams>(
    metadata.OPTION_COMMAND_IDENTIFIER,
    target,
  )
}

const validateOptionCommand = (
  target: Type,
  fieldOptions: readonly CompiledFieldOption[],
  methodHandlers: readonly HandlerParams[],
) => {
  const validHandler =
    methodHandlers.length === 1 &&
    !methodHandlers[0].flag &&
    !methodHandlers[0].path.length
  if (!validHandler) {
    throw new InternalException(SYSTEM.INVALID_OPTION_DECLARATION, {
      details: {
        handlers: methodHandlers,
        option: target.name || '(anonymous class)',
        reason: 'invalid-option-command-handler',
      },
    })
  }
  if (!fieldOptions.length) return

  throw new InternalException(SYSTEM.INVALID_OPTION_DECLARATION, {
    details: {
      fields: fieldOptions.map(option => option.propertyKey),
      option: target.name || '(anonymous class)',
      reason: 'option-command-has-fields',
    },
  })
}
