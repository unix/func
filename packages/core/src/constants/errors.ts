export enum errorCodes {
  DUPLICATE_HANDLER = 'FUNC_DUPLICATE_HANDLER',
  MISSING_PARAM_TYPES = 'FUNC_MISSING_PARAM_TYPES',
  MULTIPLE_OPTIONS = 'FUNC_MULTIPLE_OPTIONS',
  PARSE = 'FUNC_PARSE_ERROR',
  UNKNOWN_HANDLER = 'FUNC_UNKNOWN_HANDLER',
  UNSUPPORTED_ARRAY_TYPE = 'FUNC_UNSUPPORTED_ARRAY_TYPE',
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
