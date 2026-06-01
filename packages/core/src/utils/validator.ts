import {
  F_SYSTEM,
  createSystemError,
  errorTypes,
} from '../errors'

export const requireKey = (value: any, key: string) => {
  if (!value) {
    throw createSystemError(
      F_SYSTEM.MISSING_REQUIRED_PARAM,
      errorTypes.DEFINITION,
      `Param \`${key}\` is required.`,
      { key },
    )
  }
}

export const commandName = (value: string, key: string) => {
  requireKey(value, key)
  token(value, key)
}

export const commandAlias = (value: string | undefined, key: string) => {
  if (!value) return
  token(value, key)
}

export const optionName = (value: string, key: string) => {
  requireKey(value, key)
  token(value, key)
}

export const optionAlias = (value: string | undefined, key: string) => {
  if (!value) return
  token(value, key)

  if (value.length === 1) return

  throw createSystemError(
    F_SYSTEM.INVALID_PARAM_VALUE,
    errorTypes.DEFINITION,
    `Param \`${key}\` must be a single character.`,
    { key, value },
  )
}

export const mustBeArray = (value: any, key: string) => {
  if (!Array.isArray(value)) {
    throw createSystemError(
      F_SYSTEM.INVALID_PARAM_TYPE,
      errorTypes.DEFINITION,
      `Param \`${key}\` must be \`Array\`.`,
      { key, expected: 'Array' },
    )
  }
}

const token = (value: string, key: string) => {
  if (value.trim() === value && !value.startsWith('-') && !/\s/.test(value)) return

  throw createSystemError(
    F_SYSTEM.INVALID_PARAM_VALUE,
    errorTypes.DEFINITION,
    `Param \`${key}\` cannot be empty, start with "-", or contain whitespace.`,
    { key, value },
  )
}
