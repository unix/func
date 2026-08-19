import { ARGS, STDERR, STDIN, STDOUT } from '../../runtime/injection'
import { Context } from '../../runtime/context'
import { OutputHost } from '../../runtime/output'
import { MODULE_OPTION, isMultiProviderToken } from '../../options/module-option'
import type { CompiledApplication } from '../../application/model'
import type { handlers } from '../../commands/metadata'
import { compileCommandGraph } from '../../commands/graph/compiler'
import { HandlerRegistry } from '../../commands/graph/registry'
import type { HandlerRecord } from '../../commands/graph/registry'
import type { CommandParams, HandlerParams } from '../../commands/types'
import { providerRecord, providerRecords } from '../../di/module-graph'
import type {
  CompiledGraph,
  CompiledModule,
  ProviderRecord,
} from '../../di/module-graph'
import type { ExplicitProvider, ProviderToken, Type } from '../../di/types'
import type {
  CompiledModuleOption,
  CompiledModuleOptions,
} from '../../options/compiler'
import type { CompiledFieldOption } from '../../options/field-metadata'
import type { OptionCommandParams } from '../../options/types'
import type { ValueTransform, ValueValidator } from '../../options/types'
import { applicationPlan } from './serialize'

export const APPLICATION_DEFINITION_ABI = 2 as const

export type PrecompilerBuiltinReference =
  'ARGS' | 'Context' | 'MODULE_OPTION' | 'OutputHost' | 'STDERR' | 'STDIN' | 'STDOUT'

export interface StaticReferenceDefinition {
  readonly builtin?: PrecompilerBuiltinReference
  readonly id: number
  readonly name: string
}

export interface StaticReferenceValue {
  readonly reference: number
}

export type StaticValue =
  | boolean
  | null
  | number
  | string
  | StaticReferenceValue
  | readonly StaticValue[]
  | { readonly [key: string]: StaticValue | undefined }
  | undefined

export interface StaticProviderDefinition {
  readonly inject?: readonly number[]
  readonly multi: boolean
  readonly strategy: 'class' | 'factory' | 'value'
  readonly token: number
  readonly use: StaticValue
}

export interface StaticFieldOptionDefinition {
  readonly aliases: readonly string[]
  readonly dependsOn?: readonly string[]
  readonly deprecated?: true | string
  readonly description?: string
  readonly enum?: readonly (boolean | number | string)[]
  readonly exclusive?: readonly string[]
  readonly kind: 'array' | 'flag' | 'value'
  readonly name: string
  readonly negatable?: boolean
  readonly override?: boolean
  readonly propertyKey: string
  readonly required: boolean
  readonly transform?: number
  readonly type: 'boolean' | 'number' | 'number[]' | 'string' | 'string[]'
  readonly validators: readonly number[]
}

export interface StaticHandlerDefinition {
  readonly command?: CommandParams
  readonly fieldOptions: readonly StaticFieldOptionDefinition[]
  readonly handler: number
  readonly kind?: handlers
  readonly methodHandlers: readonly HandlerParams[]
}

export type StaticModuleOptionDefinition =
  StaticOptionCommandDefinition | StaticOptionProviderDefinition

interface StaticModuleOptionBase {
  readonly target: number
}

export interface StaticOptionProviderDefinition extends StaticModuleOptionBase {
  readonly fieldOptions: readonly StaticFieldOptionDefinition[]
  readonly kind: 'value'
}

export interface StaticOptionCommandDefinition extends StaticModuleOptionBase {
  readonly handler: HandlerParams
  readonly kind: 'action'
  readonly option: Omit<OptionCommandParams, 'type'>
}

export interface StaticModuleDefinition {
  readonly exports: readonly number[]
  readonly handlers: readonly StaticHandlerDefinition[]
  readonly imports: readonly number[]
  readonly input: number
  readonly name: string
  readonly options: readonly StaticModuleOptionDefinition[]
  readonly providers: readonly StaticProviderDefinition[]
}

export interface StaticApplicationDefinition {
  readonly abi: typeof APPLICATION_DEFINITION_ABI
  readonly modules: readonly StaticModuleDefinition[]
  readonly references: readonly StaticReferenceDefinition[]
  readonly rootModule: number
}

export interface EncodedReference {
  readonly $funcRef: number
}

export interface EncodedGlobal {
  readonly $funcGlobal: 'Boolean' | 'Number' | 'String' | 'undefined'
}

export type EncodedApplicationPlan = unknown

interface ReferenceTable {
  readonly reverse: ReadonlyMap<unknown, number>
  readonly values: readonly unknown[]
}

const BUILTINS: Readonly<Record<PrecompilerBuiltinReference, unknown>> = {
  ARGS,
  Context,
  MODULE_OPTION,
  OutputHost,
  STDERR,
  STDIN,
  STDOUT,
}

export const compileStaticApplication = (input: unknown): EncodedApplicationPlan => {
  if (!isStaticApplicationDefinition(input)) {
    throw new TypeError(
      `Unsupported func static application ABI: ${String(definitionAbi(input))}.`,
    )
  }
  const definition = input
  const references = referenceTable(definition.references)
  const graph = compileStaticModules(definition, references)
  const compiled = compileStaticHandlers(definition, references, graph)
  const commandGraph = compileCommandGraph({
    options: compiled.options,
    registry: new HandlerRegistry(compiled.handlers),
    root: graph.root,
  })
  const application: CompiledApplication = { commandGraph, graph }
  return encode(applicationPlan(application), references.reverse)
}

const referenceTable = (
  definitions: readonly StaticReferenceDefinition[],
): ReferenceTable => {
  const values: unknown[] = []
  const reverse = new Map<unknown, number>()
  definitions.forEach(definition => {
    if (definition.id !== values.length) {
      throw new TypeError('Func static references must use contiguous ids.')
    }
    const value = definition.builtin
      ? BUILTINS[definition.builtin]
      : syntheticType(definition.name)
    values.push(value)
    reverse.set(value, definition.id)
  })
  return { reverse, values }
}

const syntheticType = (name: string): Type => {
  const target: Type = class {}
  Object.defineProperty(target, 'name', { configurable: true, value: name })
  return target
}

const compileStaticModules = (
  definition: StaticApplicationDefinition,
  references: ReferenceTable,
): CompiledGraph => {
  const modules: CompiledModule[] = definition.modules.map(module => ({
    exports: new Map(),
    imports: [],
    input: reference<Type>(references, module.input),
    multiProviders: new Map(),
    name: module.name,
    options: [],
    providers: new Map(),
  }))
  definition.modules.forEach((source, index) => {
    const module = modules[index]
    module.imports = source.imports.map(target =>
      required(modules, target, 'module import'),
    )
    source.providers.forEach(provider => {
      const record = providerRecordFrom(provider, module, references)
      if (provider.multi) {
        const records = module.multiProviders.get(record.token) ?? []
        records.push(record)
        module.multiProviders.set(record.token, records)
        return
      }
      if (module.providers.has(record.token)) {
        throw new TypeError(`Duplicate provider in module "${module.name}".`)
      }
      module.providers.set(record.token, record)
    })
  })
  definition.modules.forEach((source, index) => {
    const module = modules[index]
    source.exports.forEach(target => {
      const token = reference<ProviderToken>(references, target)
      const multi = isMultiProviderToken(token)
      const records = multi ? providerRecords(module, token) : []
      const exported = multi
        ? records.length
          ? records
          : undefined
        : providerRecord(module, token)
      if (!exported) {
        throw new TypeError(`Invalid export in module "${module.name}".`)
      }
      module.exports.set(token, exported)
    })
  })
  return {
    modules,
    root: required(modules, definition.rootModule, 'root module'),
  }
}

const providerRecordFrom = (
  provider: StaticProviderDefinition,
  owner: CompiledModule,
  references: ReferenceTable,
  kind: ProviderRecord['kind'] = 'provider',
): ProviderRecord => {
  const token = reference<ProviderToken>(references, provider.token)
  let definition: ExplicitProvider
  if (provider.strategy === 'class') {
    definition = {
      provide: token,
      useClass: reference<Type>(
        references,
        referenceId(provider.use, 'class provider'),
      ),
    }
  } else if (provider.strategy === 'factory') {
    definition = {
      provide: token,
      useFactory: reference(
        references,
        referenceId(provider.use, 'factory provider'),
      ),
      ...(provider.inject
        ? {
            inject: provider.inject.map(target =>
              reference<ProviderToken>(references, target),
            ),
          }
        : {}),
    }
  } else {
    definition = {
      provide: token,
      useValue: materialize(provider.use, references),
    }
  }
  return { definition, kind, owner, token }
}

const compileStaticHandlers = (
  definition: StaticApplicationDefinition,
  references: ReferenceTable,
  graph: CompiledGraph,
): {
  handlers: HandlerRecord[]
  options: CompiledModuleOptions
} => {
  const handlerRecords: HandlerRecord[] = []
  const byModule = new Map<CompiledModule, readonly CompiledModuleOption[]>()
  const optionOwners = new Map<Type, CompiledModule>()
  definition.modules.forEach((source, index) => {
    const owner = graph.modules[index]
    source.handlers.forEach(handler => {
      handlerRecords.push({
        ...(handler.command ? { command: handler.command } : {}),
        fieldOptions: fieldOptions(handler.fieldOptions, references),
        handler: reference<Type>(references, handler.handler),
        ...(handler.kind ? { kind: handler.kind } : {}),
        methodHandlers: handler.methodHandlers.slice(),
        owner,
      })
    })
    const options = source.options.map(option => {
      const target = reference<Type>(references, option.target)
      const existingOwner = optionOwners.get(target)
      if (existingOwner) {
        throw new TypeError(
          `Option "${target.name}" is declared by both "${existingOwner.name}" and "${owner.name}".`,
        )
      }
      optionOwners.set(target, owner)
      const provider: StaticProviderDefinition = {
        multi: false,
        strategy: 'class',
        token: option.target,
        use: { reference: option.target },
      }
      const record = providerRecordFrom(provider, owner, references, 'option')
      if (owner.providers.has(record.token)) {
        throw new TypeError(`Duplicate option provider in module "${owner.name}".`)
      }
      owner.providers.set(record.token, record)
      owner.options.push(record)
      const base = { owner, record, target }
      if (option.kind === 'action') {
        return {
          ...base,
          handler: option.handler,
          kind: option.kind,
          option: { ...option.option, type: Boolean },
        } satisfies CompiledModuleOption
      }
      return {
        ...base,
        fieldOptions: fieldOptions(option.fieldOptions, references),
        kind: option.kind,
      } satisfies CompiledModuleOption
    })
    byModule.set(owner, options)
  })
  return {
    handlers: handlerRecords,
    options: {
      byModule,
      root: byModule.get(graph.root) ?? [],
    },
  }
}

const fieldOptions = (
  definitions: readonly StaticFieldOptionDefinition[],
  references: ReferenceTable,
): CompiledFieldOption[] => definitions.map(field => fieldOption(field, references))

const fieldOption = (
  field: StaticFieldOptionDefinition,
  references: ReferenceTable,
): CompiledFieldOption => {
  const common = {
    aliases: field.aliases,
    ...(field.dependsOn ? { dependsOn: field.dependsOn.slice() } : {}),
    ...(field.deprecated ? { deprecated: field.deprecated } : {}),
    ...(field.description ? { description: field.description } : {}),
    ...(field.enum ? { enum: field.enum.slice() } : {}),
    ...(field.exclusive ? { exclusive: field.exclusive.slice() } : {}),
    name: field.name,
    ...(field.override ? { override: true } : {}),
    propertyKey: field.propertyKey,
    required: field.required,
    ...(field.transform === undefined
      ? {}
      : { transform: reference<ValueTransform>(references, field.transform) }),
    validators: field.validators.map(target =>
      reference<ValueValidator>(references, target),
    ),
  }
  if (field.kind === 'flag') {
    return {
      ...common,
      kind: field.kind,
      ...(field.negatable ? { negatable: true } : {}),
      type: Boolean,
    }
  }
  if (field.kind === 'array') {
    return {
      ...common,
      kind: field.kind,
      type: field.type === 'number[]' ? [Number] : [String],
    }
  }
  return {
    ...common,
    kind: field.kind,
    type: field.type === 'number' ? Number : String,
  }
}

const materialize = (value: StaticValue, references: ReferenceTable): unknown => {
  if (isReferenceValue(value)) return reference(references, value.reference)
  if (isStaticArray(value)) return value.map(item => materialize(item, references))
  if (!isStaticRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, materialize(item, references)]),
  )
}

const referenceId = (value: StaticValue, kind: string): number => {
  if (isReferenceValue(value)) return value.reference
  throw new TypeError(`Invalid func static ${kind} reference.`)
}

const isReferenceValue = (value: StaticValue): value is StaticReferenceValue =>
  Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'reference' in value &&
    typeof value.reference === 'number',
  )

const isStaticRecord = (
  value: StaticValue,
): value is { readonly [key: string]: StaticValue | undefined } =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

const isStaticArray = (value: StaticValue): value is readonly StaticValue[] =>
  Array.isArray(value)

const reference = <Value>(references: ReferenceTable, index: number): Value =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  required(references.values, index, 'reference') as Value

const encode = (
  value: unknown,
  references: ReadonlyMap<unknown, number>,
): unknown => {
  const referenceIndex = references.get(value)
  if (referenceIndex !== undefined)
    return { $funcRef: referenceIndex } satisfies EncodedReference
  if (value === Boolean) return { $funcGlobal: 'Boolean' } satisfies EncodedGlobal
  if (value === Number) return { $funcGlobal: 'Number' } satisfies EncodedGlobal
  if (value === String) return { $funcGlobal: 'String' } satisfies EncodedGlobal
  if (value === undefined)
    return { $funcGlobal: 'undefined' } satisfies EncodedGlobal
  if (Array.isArray(value)) return value.map(item => encode(item, references))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, encode(item, references)]),
  )
}

const isStaticApplicationDefinition = (
  value: unknown,
): value is StaticApplicationDefinition =>
  Boolean(
    value &&
    typeof value === 'object' &&
    'abi' in value &&
    value.abi === APPLICATION_DEFINITION_ABI,
  )

const definitionAbi = (value: unknown): unknown =>
  value && typeof value === 'object' ? Reflect.get(value, 'abi') : undefined

const required = <Value>(
  values: readonly Value[],
  index: number,
  kind: string,
): Value => {
  const value = values[index]
  if (value !== undefined) return value
  throw new TypeError(`Invalid func static ${kind} index: ${index}.`)
}
