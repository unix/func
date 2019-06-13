export enum metadata {
  DESIGN_PARAM_TYPES = 'design:paramtypes',
  HOST_PARAM_TYPES = 'host:paramtypes',
  
  COMMAND_IDENTIFIER = 'command_identifier',
  OPTION_IDENTIFIER = 'option_identifier',
  SUB_OPTION_IDENTIFIER = 'sub_option_identifier',
  
  HANDLER_IDENTIFIER = 'handler_indentifier',
  INJECT_TOKEN_IDENTIFIER = 'inject_token_indentifier',
  INJECT_INDEX_IDENTIFIER = 'inject_index_indentifier',
}

export enum handlers {
  COMMAND = 'command',
  OPTION = 'option',
  NOT_FOUND = 'not_found',
  MAJOR = 'major',
}
