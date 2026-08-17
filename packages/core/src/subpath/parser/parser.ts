import { parseArgv } from '../../argv'
import type { ArgvPlan, ParsedArgv } from '../../argv'
import {
  applyParsedOptions,
  compileParserDefinition,
  initialOptions,
  type CompiledParserDefinition,
  type CompiledParserOptions,
} from './compiler'
import {
  ParserError,
  type Parser,
  type ParserCommands,
  type ParserDefinition,
  type ParserOptions,
  type ParserResult,
} from './interfaces'

export const createParser = <
  const Options extends ParserOptions = Record<never, never>,
  const Commands extends ParserCommands = Record<never, never>,
>(
  definition: ParserDefinition<Options, Commands>,
): Parser<Options, Commands> => {
  const compiled = compileParserDefinition(definition)
  return Object.freeze({
    parse: (argv: readonly string[]) =>
      // The runtime result is shaped by the validated generic definition.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      parse(compiled, argv) as ParserResult<Options, Commands>,
  })
}

const parse = (
  compiled: CompiledParserDefinition,
  argv: readonly string[],
): ParserResult<ParserOptions, ParserCommands> => {
  validateArgv(argv)
  if (!compiled.commands.size) {
    const parsed = parseOptions(compiled.options, argv)
    return result(undefined, compiled.options, [parsed], parsed.positionals)
  }

  const commandLocation = findCommand(compiled.options.plan, argv)
  if (!commandLocation) {
    const parsed = parseOptions(compiled.options, argv)
    return result(undefined, compiled.options, [parsed], parsed.positionals)
  }

  const commandName = argv[commandLocation.index]
  const command = compiled.commands.get(commandName)
  if (!command) {
    throw new ParserError('unknown-command', `Unknown command "${commandName}".`, {
      command: commandName,
    })
  }
  const root = parseOptions(compiled.options, argv.slice(0, commandLocation.index))
  const commandArgv = argv.slice(commandLocation.index + 1)
  if (commandLocation.delimited)
    return result(commandName, command.options, [root], commandArgv)
  if (!command.passthrough) {
    const parsed = parseOptions(command.options, commandArgv)
    return result(commandName, command.options, [root, parsed], parsed.positionals)
  }

  const split = splitPassthrough(command.options.plan, commandArgv)
  const parsed = parseOptions(command.options, split.options)
  return result(commandName, command.options, [root, parsed], split.inputs)
}

const result = (
  command: string | undefined,
  compiled: CompiledParserOptions,
  parsedResults: readonly ParsedArgv[],
  inputs: readonly string[],
): ParserResult<ParserOptions, ParserCommands> => {
  const options = initialOptions(compiled.definitions)
  const supplied = new Set<string>()
  parsedResults.forEach(parsed => {
    applyParsedOptions(options, supplied, compiled, parsed)
  })
  Object.keys(options).forEach(key => {
    const value = options[key]
    if (Array.isArray(value)) options[key] = Object.freeze(value.slice())
  })
  const invocation = Object.freeze({
    command,
    inputs: Object.freeze(inputs.slice()),
    options: Object.freeze(options),
    supplied,
  })
  // Compiled definitions guarantee the runtime option shape.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return invocation as ParserResult<ParserOptions, ParserCommands>
}

const parseOptions = (
  compiled: CompiledParserOptions,
  argv: readonly string[],
): ParsedArgv => {
  const parsedResult = parseArgv(compiled.plan, argv)
  if (!parsedResult.success) {
    throw new ParserError(
      'invalid-argument',
      parsedResult.failure.message,
      parsedResult.failure.details,
    )
  }
  if (!parsedResult.parsed.unknown.length) return parsedResult.parsed
  const options = parsedResult.parsed.unknown
  throw new ParserError(
    'unknown-option',
    `Unknown option${options.length > 1 ? 's' : ''}: ${options.join(', ')}.`,
    { options },
  )
}

const findCommand = (
  plan: ArgvPlan,
  argv: readonly string[],
): { readonly delimited: boolean; readonly index: number } | undefined => {
  for (let index = 0; index < argv.length; index += 1) {
    const input = argv[index]
    if (input === '--') {
      return index + 1 >= argv.length
        ? undefined
        : { delimited: true, index: index + 1 }
    }
    if (!isOptionInput(input)) return { delimited: false, index }
    index = optionEndIndex(plan, argv, index)
  }
  return undefined
}

const splitPassthrough = (
  plan: ArgvPlan,
  argv: readonly string[],
): { readonly inputs: readonly string[]; readonly options: readonly string[] } => {
  for (let index = 0; index < argv.length; index += 1) {
    const input = argv[index]
    if (input === '--')
      return { inputs: argv.slice(index + 1), options: argv.slice(0, index) }
    if (!isOptionInput(input))
      return { inputs: argv.slice(index), options: argv.slice(0, index) }
    index = optionEndIndex(plan, argv, index)
  }
  return { inputs: [], options: argv }
}

const optionEndIndex = (
  plan: ArgvPlan,
  argv: readonly string[],
  index: number,
): number => {
  const input = argv[index]
  if (input.startsWith('--')) {
    const equals = input.indexOf('=')
    const token = equals < 0 ? input : input.slice(0, equals)
    const definition = plan.tokens.get(token)
    if (!definition || definition.option.type === 'boolean' || equals >= 0)
      return index
    return index + 1
  }

  const definitions = Array.from(input.slice(1), alias =>
    plan.tokens.get(`-${alias}`),
  )
  if (
    definitions.some(definition => !definition) ||
    definitions.at(-1)?.option.type === 'boolean'
  )
    return index
  return index + 1
}

const validateArgv = (argv: readonly string[]) => {
  if (Array.isArray(argv) && argv.every(value => typeof value === 'string')) return
  throw new ParserError(
    'invalid-argument',
    'Parser argv must be an array of strings.',
    { argv },
  )
}

const isOptionInput = (value: string): boolean =>
  value.length > 1 && value.startsWith('-')
