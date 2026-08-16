import type { ArgPlan, ArgToken } from '../../arg/interfaces'

export interface ParsedCompletionArgs {
  readonly endOfOptions: boolean
  readonly expected?: ArgToken
  readonly positionals: readonly string[]
  readonly supplied: ReadonlySet<string>
}

export const parseCompletionArgs = (
  plan: ArgPlan,
  argv: readonly string[],
): ParsedCompletionArgs => {
  const positionals: string[] = []
  const supplied = new Set<string>()
  let endOfOptions = false
  let expected: ArgToken | undefined

  for (const input of argv) {
    if (endOfOptions) {
      positionals.push(input)
      continue
    }
    if (expected) {
      if (!isOptionInput(input) || isSeparatedNumber(expected, input)) {
        supplied.add(expected.option.name)
        expected = undefined
        continue
      }
      expected = undefined
    }
    if (input === '--') {
      endOfOptions = true
      continue
    }
    if (!isOptionInput(input)) {
      positionals.push(input)
      continue
    }

    expected = input.startsWith('--')
      ? parseLongOption(plan, input, supplied)
      : parseShortOptions(plan, input, supplied)
  }

  return {
    endOfOptions,
    ...(expected ? { expected } : {}),
    positionals,
    supplied,
  }
}

const parseLongOption = (
  plan: ArgPlan,
  input: string,
  supplied: Set<string>,
): ArgToken | undefined => {
  const equals = input.indexOf('=')
  const token = equals < 0 ? input : input.slice(0, equals)
  const definition = plan.tokens.get(token)
  if (!definition) return undefined
  supplied.add(definition.option.name)
  if (definition.option.type === 'boolean' || equals >= 0) return undefined
  supplied.delete(definition.option.name)
  return definition
}

const parseShortOptions = (
  plan: ArgPlan,
  input: string,
  supplied: Set<string>,
): ArgToken | undefined => {
  const definitions = Array.from(input.slice(1), alias =>
    plan.tokens.get(`-${alias}`),
  )
  if (definitions.some(definition => !definition)) return undefined

  for (const definition of definitions) {
    if (!definition) continue
    supplied.add(definition.option.name)
    if (definition.option.type === 'boolean') continue
    supplied.delete(definition.option.name)
    return definition
  }

  return undefined
}

const isOptionInput = (value: string): boolean =>
  value.length > 1 && value.startsWith('-')

const isSeparatedNumber = (definition: ArgToken, value: string): boolean => {
  if (definition.option.type !== 'number' || !value.trim().length) return false
  return Number.isFinite(Number(value)) || /^-(?:Infinity|NaN)$/.test(value)
}
