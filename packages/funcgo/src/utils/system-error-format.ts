import { inspect } from 'node:util'
import type { SYSTEM } from '@func/contracts/core-errors'
import {
  formatCannotInferValueTypeError,
  isCannotInferValueTypeError,
} from './dev-error-format'
import type { FormatErrorOptions } from './dev-error-format'
import { style } from './style'

interface ExceptionLike {
  code?: unknown
  details?: unknown
  message?: unknown
  pluginCode?: unknown
}

const SYSTEM_ERROR_CODE_PREFIX = 'F_SYSTEM_'

const summaries: Readonly<Record<string, string | undefined>> = {
  AMBIGUOUS_OPTION_SCOPE:
    'A command belongs to multiple incompatible option scopes.',
  CANNOT_INFER_VALUE_TYPE: 'A field option runtime type could not be inferred.',
  CIRCULAR_MODULE_IMPORT: 'The application has a circular module import.',
  CIRCULAR_PROVIDER_DEPENDENCY:
    'The application has a circular provider dependency.',
  DUPLICATE_APPLICATION_FEATURE:
    'An application feature is registered more than once.',
  DUPLICATE_COMMAND_TOKEN: 'A command token is registered more than once.',
  DUPLICATE_OPTION_TOKEN: 'An option token is registered more than once.',
  DUPLICATE_PROVIDER: 'A provider is registered more than once.',
  EXPECTED_ARRAY_PARAM: 'A definition parameter must be an array.',
  HANDLER_ALIAS_REQUIRES_FLAG: 'Handler aliases require a flag handler.',
  HANDLER_FLAG_PATH_CONFLICT: 'A handler cannot declare both a flag and a path.',
  INTERNAL_INVARIANT: 'An internal func invariant failed.',
  INVALID_APP_NAME: 'The application name is invalid for this capability.',
  INVALID_APPLICATION_FEATURE: 'An application feature is invalid.',
  INVALID_APPLICATION_FEATURE_LIST: 'The application feature list is invalid.',
  INVALID_ARGS_DECORATOR_TARGET: 'The @Args decorator target is invalid.',
  INVALID_COMPLETION_BIN: 'The completion binary name is invalid.',
  INVALID_COMPLETION_MODE: 'The completion mode is unsupported.',
  INVALID_COMPLETION_REQUEST: 'The completion request is invalid.',
  INVALID_COMPLETION_SHELL: 'The completion shell is unsupported.',
  INVALID_FIELD_DECORATOR_TARGET: 'A field decorator target is invalid.',
  INVALID_METHOD_DECORATOR_TARGET: 'A method decorator target is invalid.',
  INVALID_MODULE_EXPORT: 'A module exports an unavailable provider.',
  INVALID_MODULE_INPUT: 'A module definition is invalid.',
  INVALID_OPTION_ALIAS: 'An option alias is invalid.',
  INVALID_OPTION_DECLARATION: 'An option declaration is invalid.',
  INVALID_OPTION_TYPE: 'A field option type is invalid.',
  INVALID_OVERRIDE_TARGET: 'An option override target is invalid.',
  INVALID_PROVIDER: 'A provider definition is invalid.',
  INVALID_TOKEN: 'A definition token is invalid.',
  MISSING_APP_NAME: 'This capability requires an application name.',
  MISSING_HANDLER: 'A command does not declare a handler.',
  MISSING_PARAM_TYPES: 'A provider dependency type could not be inferred.',
  MISSING_PROVIDER: 'A required provider is not registered or active.',
  MISSING_REQUIRED_PARAM: 'A required definition parameter is missing.',
  MULTIPLE_DEFAULT_HANDLERS: 'A command declares more than one default handler.',
  MULTIPLE_MAJOR_COMMANDS: 'More than one major command is registered.',
  MULTIPLE_MISSING_COMMANDS: 'More than one missing command is registered.',
  NO_MATCHING_HANDLER: 'A command does not have a matching handler.',
  OPTION_OVERRIDE_REQUIRED: 'An inherited option must be overridden explicitly.',
  UNKNOWN_HANDLER: 'A handler is not attached to a supported func host.',
} satisfies Readonly<Record<SYSTEM, string>>

const additionalSummaries: Readonly<Record<string, string | undefined>> = {
  DEFINITION: 'A capability definition is invalid.',
  DUPLICATE_FILE: 'A config file is initialized more than once.',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isSystemError = (error: unknown): error is ExceptionLike =>
  systemErrorCode(error) !== undefined

export const formatSystemError = (
  error: ExceptionLike,
  options: FormatErrorOptions = {},
): string => {
  if (isCannotInferValueTypeError({ code: error.code }))
    return formatCannotInferValueTypeError(error, options)

  const code = systemErrorCode(error) ?? `${SYSTEM_ERROR_CODE_PREFIX}UNKNOWN`
  const suffix = code.slice(SYSTEM_ERROR_CODE_PREFIX.length)
  const suppliedMessage =
    typeof error.message === 'string' && error.message !== code
      ? error.message
      : undefined
  const message =
    suppliedMessage ??
    summaries[suffix] ??
    additionalSummaries[suffix] ??
    'The func application definition is invalid.'
  const stream = options.stream ?? process.stderr
  const details = formatDetails(error.details)

  return [
    style.error(message, stream),
    style.dim(code, stream),
    ...(details.length ? ['', style.warning('Details:', stream), ...details] : []),
  ].join('\n')
}

const systemErrorCode = (error: unknown): string | undefined => {
  if (!isRecord(error)) return undefined
  const code = [error.code, error.pluginCode].find(
    value => typeof value === 'string' && value.startsWith(SYSTEM_ERROR_CODE_PREFIX),
  )
  return typeof code === 'string' ? code : undefined
}

const formatDetails = (value: unknown): string[] => {
  if (!isRecord(value)) return []
  return Object.entries(value).map(([key, detail]) => {
    const formatted = inspect(detail, {
      breakLength: 100,
      colors: false,
      compact: true,
      depth: 2,
      sorted: true,
    })
    return `  ${key}: ${formatted}`
  })
}
