import type { ArgToken, ArgvPlan } from '../../argv/interfaces'
import { isSeparatedNumber } from '../../argv/parser'

export interface ParsedCompletionArgs {
  readonly endOfOptions: boolean
  readonly expected?: ArgToken
  readonly positionals: readonly string[]
  readonly supplied: ReadonlySet<string>
}

export const parseCompletionArgs = (
  plan: ArgvPlan,
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
      if (!isOptionInput(input) || isSeparatedNumber(expected.option, input)) {
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
  plan: ArgvPlan,
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
  plan: ArgvPlan,
  input: string,
  supplied: Set<string>,
): ArgToken | undefined => {
  const definitions = Array.from(input.slice(1), alias =>
    plan.tokens.get(`-${alias}`),
  )
  if (
    !definitions.every(
      (definition): definition is ArgToken => definition !== undefined,
    )
  )
    return undefined

  for (const definition of definitions) {
    supplied.add(definition.option.name)
    if (definition.option.type === 'boolean') continue
    supplied.delete(definition.option.name)
    return definition
  }

  return undefined
}

const isOptionInput = (value: string): boolean =>
  value.length > 1 && value.startsWith('-')
