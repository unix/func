import { SYSTEM } from '@func/contracts/core-errors'
import { InternalException } from './shared/errors'

export const requireKey = (value: unknown, key: string) => {
  if (!value) {
    throw new InternalException(SYSTEM.MISSING_REQUIRED_PARAM, {
      details: { key },
    })
  }
}

export const commandName = (value: string, key: string) => {
  requireKey(value, key)
  token(value, key)
}

export const commandAlias = (value: string | undefined, key: string) => {
  if (value === undefined) return
  token(value, key)
}

export const optionName = (value: string, key: string) => {
  requireKey(value, key)
  token(value, key)
  if (!value.includes('=')) return

  throw new InternalException(SYSTEM.INVALID_TOKEN, {
    details: { key, value },
  })
}

export const optionAlias = (value: string | undefined, key: string) => {
  if (value === undefined) return
  token(value, key)
  if (value.length === 1 && value !== '=' && !/^\d$/.test(value)) return

  throw new InternalException(SYSTEM.INVALID_OPTION_ALIAS, {
    details: { key, value },
  })
}

export const commandAliases = (
  alias?: string,
  aliases?: readonly string[],
): readonly string[] => normalizeAliases(alias, aliases, commandAlias)

export const optionAliases = (
  alias?: string,
  aliases?: readonly string[],
): readonly string[] => normalizeAliases(alias, aliases, optionAlias)

export const mustBeArray = (value: unknown, key: string) => {
  if (!Array.isArray(value)) {
    throw new InternalException(SYSTEM.EXPECTED_ARRAY_PARAM, {
      details: { expected: 'Array', key },
    })
  }
}

type AliasValidator = (value: string | undefined, key: string) => void

const normalizeAliases = (
  alias: string | undefined,
  aliases: readonly string[] | undefined,
  validate: AliasValidator,
): readonly string[] => {
  if (alias !== undefined) validate(alias, 'alias')
  if (aliases === undefined) return alias === undefined ? [] : [alias]
  mustBeArray(aliases, 'aliases')
  aliases.forEach(value => validate(value, 'aliases'))
  return Array.from(new Set(alias === undefined ? aliases : [alias, ...aliases]))
}

const token = (value: string, key: string) => {
  if (
    typeof value === 'string' &&
    value.length > 0 &&
    value.trim() === value &&
    !value.startsWith('-') &&
    !/\s/.test(value)
  )
    return

  throw new InternalException(SYSTEM.INVALID_TOKEN, {
    details: { key, value },
  })
}
