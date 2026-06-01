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
