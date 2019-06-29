export enum metadata {
  DESIGN_PARAM_TYPES = 'design:paramtypes',
  HOST_PARAM_TYPES = 'host:paramtypes',
  
  COMMAND_IDENTIFIER = 'command_ident',
  OPTION_IDENTIFIER = 'option_ident',
  SUB_OPTION_IDENTIFIER = 'sub_o_ident',
  
  HANDLER_IDENTIFIER = 'handler_ident',
  INJECT_TOKEN_IDENTIFIER = 'inject_t_ident',
  INJECT_INDEX_IDENTIFIER = 'inject_i_ident',
}

export enum handlers {
  COMMAND = 'command',
  OPTION = 'option',
  MISSING = 'missing',
  MAJOR = 'major',
}
