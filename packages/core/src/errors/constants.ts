export const F_SYSTEM = {
  DUPLICATE_HANDLER: 'F_SYSTEM_DUPLICATE_HANDLER',
  INVALID_PARAM_TYPE: 'F_SYSTEM_INVALID_PARAM_TYPE',
  INVALID_PARAM_VALUE: 'F_SYSTEM_INVALID_PARAM_VALUE',
  MISSING_PROVIDER: 'F_SYSTEM_MISSING_PROVIDER',
  MISSING_PARAM_TYPES: 'F_SYSTEM_MISSING_PARAM_TYPES',
  MISSING_REQUIRED_PARAM: 'F_SYSTEM_MISSING_REQUIRED_PARAM',
  UNKNOWN_HANDLER: 'F_SYSTEM_UNKNOWN_HANDLER',
  UNSUPPORTED_ARRAY_TYPE: 'F_SYSTEM_UNSUPPORTED_ARRAY_TYPE',
} as const

export const F_RUNTIME = {
  HANDLER_ERROR: 'F_RUNTIME_HANDLER_ERROR',
} as const

export const F_RUNTIME_PRINT = {
  MULTIPLE_OPTIONS: 'F_RUNTIME_PRINT_MULTIPLE_OPTIONS',
  PARSE: 'F_RUNTIME_PRINT_PARSE',
  UNKNOWN_OPTION: 'F_RUNTIME_PRINT_UNKNOWN_OPTION',
} as const

export const F_EFFECT = {
  DEPRECATED_API: 'F_EFFECT_DEPRECATED_API',
} as const

export type FuncErrorCode =
  | (typeof F_SYSTEM)[keyof typeof F_SYSTEM]
  | (typeof F_RUNTIME)[keyof typeof F_RUNTIME]
  | (typeof F_RUNTIME_PRINT)[keyof typeof F_RUNTIME_PRINT]
  | (typeof F_EFFECT)[keyof typeof F_EFFECT]

export enum errorLevels {
  EFFECT = 'effect',
  RUNTIME = 'runtime',
  RUNTIME_PRINT = 'runtime-print',
  SYSTEM = 'system',
}

export enum errorTypes {
  DEFINITION = 'definition',
  DEPRECATION = 'deprecation',
  HANDLER = 'handler',
  INJECTION = 'injection',
  INPUT = 'input',
  REGISTRATION = 'registration',
}

export enum errorScopes {
  COMMAND = 'command',
  OPTION = 'option',
}

export enum errorTokenTypes {
  COMMAND_ALIAS = 'command alias',
  COMMAND_NAME = 'command name',
  OPTION_ALIAS = 'option alias',
  OPTION_NAME = 'option name',
}
