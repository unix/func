import arg from 'arg'
import type { OptionParams } from '../interfaces'
import { createDictionary } from './dictionary'

export type OptionKeyValue = arg.Spec

export const optionsToKeyValue = (
  params: readonly OptionParams[] = [],
): OptionKeyValue => {
  const options = createDictionary<arg.Spec[string]>()
  let order = 0
  params.forEach(current => {
    const name = `--${current.name}`
    if (current.type === Boolean && current.negatable === true) {
      options[name] = arg.flag(() => {
        order += 1
        return { order, value: true }
      })
      options[`--no-${current.name}`] = arg.flag(() => {
        order += 1
        return { order, value: false }
      })
      current.aliases.forEach(alias => {
        options[`-${alias}`] = name
      })
      return
    }

    options[name] = current.type
    current.aliases.forEach(alias => {
      options[`-${alias}`] = name
    })
  })
  return options
}

export const normalizeNumberArrayArguments = (
  params: readonly OptionParams[],
  argv: readonly string[],
): string[] => {
  const names = new Map<string, string>()
  params.forEach(current => {
    if (!Array.isArray(current.type) || current.type[0] !== Number) return
    const name = `--${current.name}`
    names.set(name, name)
    current.aliases.forEach(alias => {
      names.set(`-${alias}`, name)
    })
  })

  const normalized: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === '--') {
      normalized.push(...argv.slice(index))
      break
    }

    const name = names.get(current)
    if (!name || index + 1 >= argv.length) {
      normalized.push(current)
      continue
    }

    const next = argv[index + 1]
    if (!isNegativeNumberArgument(next)) {
      normalized.push(current)
      continue
    }

    normalized.push(`${name}=${next}`)
    index += 1
  }
  return normalized
}

export const normalizeNegatableOptions = (
  params: readonly OptionParams[],
  args: arg.Result<any>,
) => {
  params.forEach(current => {
    if (current.type !== Boolean || current.negatable !== true) return
    const name = `--${current.name}`
    const negativeName = `--no-${current.name}`
    const positive: unknown = args[name]
    const negative: unknown = args[negativeName]
    const values = [positive, negative].filter(isNegatableFlagValue)
    if (!values.length) return
    const selected = values.reduce((latest, value) =>
      value.order > latest.order ? value : latest,
    )
    args[name] = selected.value
    Reflect.deleteProperty(args, negativeName)
  })
}

interface NegatableFlagValue {
  order: number
  value: boolean
}

const isNegatableFlagValue = (value: unknown): value is NegatableFlagValue =>
  typeof value === 'object' &&
  value !== null &&
  'order' in value &&
  typeof value.order === 'number' &&
  'value' in value &&
  typeof value.value === 'boolean'

const isNegativeNumberArgument = (value: string): boolean =>
  /^-(?:\d+|\d*\.\d+)$/.test(value)
