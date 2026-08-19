import { SYSTEM } from '@func/contracts/core-errors'
import type { ParsedUserOptionValue } from '../options/types'
import type {
  ArgOption,
  ArgParseFailure,
  ArgParseResult,
  ArgToken,
  ArgvPlan,
  ParsedArgv,
} from './interfaces'
import { createOptionRecord } from './option-record'
import { InternalException } from '../shared/errors'

export const parseArgv = (
  plan: ArgvPlan,
  argv: readonly string[],
): ArgParseResult => {
  const options = createOptionRecord(plan.options)
  const positionals: string[] = []
  const supplied = new Set<string>()
  const unknown: string[] = []
  const state: ParseState = { argv, options, plan, supplied, unknown }

  for (let index = 0; index < argv.length; index += 1) {
    const input = argv[index]
    if (input === '--') {
      positionals.push(...argv.slice(index + 1))
      break
    }
    if (!isOptionInput(input)) {
      positionals.push(input)
      continue
    }

    const parsed = input.startsWith('--')
      ? parseLongOption(state, index)
      : parseShortOptions(state, index)
    if (!parsed.success) return parsed
    index = parsed.nextIndex
  }

  const parsed: ParsedArgv = {
    options,
    positionals,
    supplied,
    unknown,
  }
  return { parsed, success: true }
}

interface ParsedOption {
  readonly nextIndex: number
  readonly success: true
}

interface ParseState {
  readonly argv: readonly string[]
  readonly options: Record<string, ParsedUserOptionValue>
  readonly plan: ArgvPlan
  readonly supplied: Set<string>
  readonly unknown: string[]
}

type OptionResult =
  ParsedOption | { readonly failure: ArgParseFailure; success: false }

type ValueResult =
  | { readonly success: true; readonly value: number | string }
  | { readonly failure: ArgParseFailure; success: false }

const parseLongOption = (state: ParseState, index: number): OptionResult => {
  const input = state.argv[index]
  const equals = input.indexOf('=')
  const token = equals < 0 ? input : input.slice(0, equals)
  const attached = equals < 0 ? undefined : input.slice(equals + 1)
  const definition = state.plan.tokens.get(token)
  if (!definition) {
    state.unknown.push(input)
    return { nextIndex: index, success: true }
  }
  if (definition.option.type === 'boolean') {
    if (attached !== undefined) return unexpectedBooleanValue(token, attached)
    setOption(state, definition, definition.booleanValue ?? true)
    return { nextIndex: index, success: true }
  }

  return parseValueOption(state, definition, token, attached, index)
}

const parseShortOptions = (state: ParseState, index: number): OptionResult => {
  const input = state.argv[index]
  const tokens = Array.from(input.slice(1), alias => `-${alias}`)
  const definitions = tokens.flatMap(token => {
    const definition = state.plan.tokens.get(token)
    return definition ? [{ definition, token }] : []
  })
  if (definitions.length !== tokens.length) {
    state.unknown.push(input)
    return { nextIndex: index, success: true }
  }

  for (let offset = 0; offset < definitions.length; offset += 1) {
    const { definition, token } = definitions[offset]
    if (definition.option.type === 'boolean') {
      setOption(state, definition, definition.booleanValue ?? true)
      continue
    }
    if (offset < definitions.length - 1) {
      return failure(
        `Option "${token}" requires an argument and cannot be followed by another short option.`,
        { option: token },
      )
    }

    return parseValueOption(state, definition, token, undefined, index)
  }

  return { nextIndex: index, success: true }
}

const parseValueOption = (
  state: ParseState,
  definition: ArgToken,
  token: string,
  attached: string | undefined,
  index: number,
): OptionResult => {
  const separated = attached === undefined
  const rawValue = separated ? state.argv.at(index + 1) : attached
  if (
    rawValue === undefined ||
    (separated &&
      isOptionInput(rawValue) &&
      !isSeparatedNumber(definition.option, rawValue))
  ) {
    return missingValue(token, definition.option)
  }

  const converted = convertValue(definition.option, token, rawValue)
  if (!converted.success) return converted
  setOption(state, definition, converted.value)
  return { nextIndex: separated ? index + 1 : index, success: true }
}

const convertValue = (
  option: ArgOption,
  token: string,
  value: string,
): ValueResult => {
  if (option.type === 'string') return { success: true, value }
  if (value.trim().length) {
    const number = Number(value)
    if (Number.isFinite(number)) return { success: true, value: number }
  }

  return failure(`Option "--${option.name}" must be a finite number.`, {
    option: token,
    value,
  })
}

const setOption = (
  state: ParseState,
  definition: ArgToken,
  value: boolean | number | string,
) => {
  const { multiple, name } = definition.option
  if (!multiple) {
    state.options[name] = value
    state.supplied.add(name)
    return
  }

  const current = state.options[name]
  if (definition.option.type === 'number' && typeof value === 'number') {
    if (isNumberArray(current)) current.push(value)
    else state.options[name] = [value]
    state.supplied.add(name)
    return
  }
  if (definition.option.type === 'string' && typeof value === 'string') {
    if (isStringArray(current)) current.push(value)
    else state.options[name] = [value]
    state.supplied.add(name)
    return
  }

  throw new InternalException(SYSTEM.INTERNAL_INVARIANT, {
    details: { option: name },
  })
}

const missingValue = (token: string, option: ArgOption): OptionResult =>
  failure(`Option "${token}" requires an argument.`, {
    option: `--${option.name}`,
    token,
  })

const unexpectedBooleanValue = (token: string, value: string): OptionResult =>
  failure(`Option "${token}" does not accept a value.`, { option: token, value })

const failure = (
  message: string,
  details: Record<string, unknown>,
): { readonly failure: ArgParseFailure; success: false } => ({
  failure: { details, message },
  success: false,
})

const isOptionInput = (value: string): boolean =>
  value.length > 1 && value.startsWith('-')

export const isSeparatedNumber = (option: ArgOption, value: string): boolean => {
  if (option.type !== 'number' || !value.trim().length) return false
  return Number.isFinite(Number(value)) || /^-(?:Infinity|NaN)$/.test(value)
}

const isNumberArray = (value: ParsedUserOptionValue): value is number[] =>
  Array.isArray(value) && (!value.length || typeof value[0] === 'number')

const isStringArray = (value: ParsedUserOptionValue): value is string[] =>
  Array.isArray(value) && (!value.length || typeof value[0] === 'string')
