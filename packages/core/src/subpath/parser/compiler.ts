import { ArgTokenConflict, compileArgvPlan } from '../../argv'
import type { ArgvPlan, ParsedArgv } from '../../argv'
import type { ArgValueType } from '../../argv/interfaces'
import {
  ParserError,
  type ParserDefinition,
  type ParserOption,
  type ParserOptionType,
  type ParserOptions,
} from './interfaces'

export interface CompiledParserOption {
  readonly key: string
  readonly multiple: boolean
  readonly name: string
  readonly type: ArgValueType
}

export interface CompiledParserOptions {
  readonly definitions: readonly CompiledParserOption[]
  readonly plan: ArgvPlan
}

export interface CompiledParserCommand {
  readonly options: CompiledParserOptions
  readonly passthrough: boolean
}

export interface CompiledParserDefinition {
  readonly commands: ReadonlyMap<string, CompiledParserCommand>
  readonly options: CompiledParserOptions
}

interface OptionSource {
  readonly options: ParserOptions
  readonly owner: string
}

interface ParserOptionInput {
  readonly alias?: unknown
  readonly aliases?: unknown
  readonly multiple?: unknown
  readonly name?: unknown
  readonly negatable?: unknown
  readonly type: unknown
}

export const compileParserDefinition = (
  input: ParserDefinition,
): CompiledParserDefinition => {
  if (!isRecord(input))
    return invalidDefinition('Parser definition must be an object.')
  const rootOptions = parserOptions(input.options, 'options')
  const options = compileOptions([{ options: rootOptions, owner: 'options' }])
  const commandInputs = parserCommands(input.commands)
  const commands = new Map<string, CompiledParserCommand>()
  Object.entries(commandInputs).forEach(([name, command]) => {
    validateToken(name, `commands.${name}`)
    const commandRecord = requiredRecord(
      command,
      `Command "${name}" must be an object.`,
    )
    const passthrough = commandRecord.passthrough
    if (passthrough !== undefined && typeof passthrough !== 'boolean') {
      invalidDefinition(`Command "${name}" passthrough must be a boolean.`)
    }
    const localOptions = parserOptions(
      commandRecord.options,
      `commands.${name}.options`,
    )
    commands.set(name, {
      options: compileOptions([
        { options: rootOptions, owner: 'options' },
        { options: localOptions, owner: `commands.${name}.options` },
      ]),
      passthrough: passthrough === true,
    })
  })

  return { commands, options }
}

export const applyParsedOptions = (
  values: Record<string, unknown>,
  supplied: Set<string>,
  compiled: CompiledParserOptions,
  parsed: ParsedArgv,
) => {
  compiled.definitions.forEach(definition => {
    if (!parsed.supplied.has(definition.name)) return
    const value = parsed.options[definition.name]
    if (definition.multiple && Array.isArray(value)) {
      const current = values[definition.key]
      values[definition.key] = Array.isArray(current)
        ? current.concat(value)
        : value.slice()
      supplied.add(definition.key)
      return
    }
    values[definition.key] = value
    supplied.add(definition.key)
  })
}

export const initialOptions = (
  definitions: readonly CompiledParserOption[],
): Record<string, unknown> => {
  const options: Record<string, unknown> = {}
  Object.setPrototypeOf(options, null)
  definitions.forEach(definition => {
    if (definition.type === 'boolean') {
      options[definition.key] = false
      return
    }
    options[definition.key] = definition.multiple ? [] : undefined
  })
  return options
}

const compileOptions = (sources: readonly OptionSource[]): CompiledParserOptions => {
  const keys = new Set<string>()
  const definitions: CompiledParserOption[] = []
  const planDefinitions = sources.flatMap(source =>
    Object.entries(source.options).map(([key, input]) => {
      if (keys.has(key)) invalidDefinition(`Duplicate parser option key "${key}".`)
      keys.add(key)
      const option = normalizeOption(key, input)
      definitions.push(option.compiled)
      return {
        option: option.plan,
        owner: `${source.owner}.${key}`,
      }
    }),
  )

  try {
    const plan = compileArgvPlan(planDefinitions)
    return {
      definitions,
      plan,
    }
  } catch (error) {
    if (error instanceof ArgTokenConflict) {
      return invalidDefinition(`Duplicate parser option token "${error.token}".`, {
        first: error.firstOwner,
        second: error.secondOwner,
        token: error.token,
      })
    }
    throw error
  }
}

const normalizeOption = (
  key: string,
  input: ParserOption,
): {
  readonly compiled: CompiledParserOption
  readonly plan: {
    readonly aliases: readonly string[]
    readonly name: string
    readonly negatable?: boolean
    readonly type:
      | BooleanConstructor
      | NumberConstructor
      | StringConstructor
      | [NumberConstructor | StringConstructor]
  }
} => {
  if (!key.length) return invalidDefinition('Parser option keys cannot be empty.')
  const rawParams: unknown = isParserOptionType(input) ? { type: input } : input
  if (!isParserOptionInput(rawParams))
    return invalidDefinition(`Parser option "${key}" has an invalid type.`)
  const params = rawParams
  const type = params.type
  if (!isParserOptionType(type))
    return invalidDefinition(`Parser option "${key}" has an invalid type.`)
  const name = params.name === undefined ? key : params.name
  validateOptionName(name, `options.${key}.name`)
  const aliases = normalizeAliases(params.alias, params.aliases, key)
  const multiple = params.multiple === true
  if (params.multiple !== undefined && typeof params.multiple !== 'boolean')
    return invalidDefinition(`Parser option "${key}" multiple must be a boolean.`)
  if (params.negatable !== undefined && typeof params.negatable !== 'boolean')
    return invalidDefinition(`Parser option "${key}" negatable must be a boolean.`)
  if (type !== Boolean && params.negatable !== undefined)
    return invalidDefinition(`Only boolean parser option "${key}" can be negatable.`)
  const valueType = optionType(type)
  let planType:
    | BooleanConstructor
    | NumberConstructor
    | StringConstructor
    | [NumberConstructor | StringConstructor] = type
  if (multiple) {
    if (type === Boolean)
      return invalidDefinition(`Boolean parser option "${key}" cannot be multiple.`)
    planType = [type === Number ? Number : String]
  }
  return {
    compiled: { key, multiple, name, type: valueType },
    plan: {
      aliases,
      name,
      ...(params.negatable === true ? { negatable: true } : {}),
      type: planType,
    },
  }
}

const normalizeAliases = (
  alias: unknown,
  aliases: unknown,
  key: string,
): readonly string[] => {
  const values: string[] = []
  if (alias !== undefined) values.push(normalizeAlias(alias, key))
  if (aliases !== undefined) {
    if (!isUnknownArray(aliases))
      return invalidDefinition(`Parser option "${key}" aliases must be an array.`)
    aliases.forEach(value => values.push(normalizeAlias(value, key)))
  }
  return Array.from(new Set(values))
}

const normalizeAlias = (value: unknown, key: string): string => {
  if (
    typeof value === 'string' &&
    value.length === 1 &&
    value !== '=' &&
    !/^\d$/.test(value)
  )
    return value
  return invalidDefinition(
    `Parser option "${key}" aliases must be non-numeric single characters other than "=".`,
  )
}

const parserOptions = (input: unknown, owner: string): ParserOptions => {
  if (input === undefined) return {}
  if (isParserOptions(input)) return input
  return invalidDefinition(`Parser ${owner} must be an object.`)
}

const parserCommands = (input: unknown): Record<string, unknown> => {
  if (input === undefined) return {}
  if (isRecord(input)) return input
  return invalidDefinition('Parser commands must be an object.')
}

const optionType = (type: ParserOptionType): ArgValueType => {
  if (type === Boolean) return 'boolean'
  if (type === Number) return 'number'
  return 'string'
}

const validateOptionName: (
  value: unknown,
  owner: string,
) => asserts value is string = (value, owner) => {
  validateToken(value, owner)
  if (typeof value === 'string' && !value.includes('=')) return
  invalidDefinition(`Parser ${owner} cannot contain "=".`)
}

const validateToken: (value: unknown, owner: string) => asserts value is string = (
  value,
  owner,
) => {
  if (
    typeof value === 'string' &&
    value.length > 0 &&
    value.trim() === value &&
    !value.startsWith('-') &&
    !/\s/.test(value)
  )
    return
  invalidDefinition(
    `Parser ${owner} cannot be empty, start with "-", or contain whitespace.`,
  )
}

const isParserOptionType = (value: unknown): value is ParserOptionType =>
  value === Boolean || value === Number || value === String

const isParserOptionInput = (value: unknown): value is ParserOptionInput =>
  isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'type')

const isParserOptions = (value: unknown): value is ParserOptions => isRecord(value)

const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const requiredRecord = (
  value: unknown,
  message: string,
): Record<string, unknown> => {
  if (isRecord(value)) return value
  return invalidDefinition(message)
}

const invalidDefinition = (
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): never => {
  throw new ParserError('invalid-definition', message, details)
}
