export enum metadata {
  DESIGN_PARAM_TYPES = 'design:paramtypes',
  DESIGN_TYPE = 'design:type',
  HOST_PARAM_TYPES = 'host:paramtypes',

  COMMAND_IDENTIFIER = 'command_ident',
  FIELD_OPTION_IDENTIFIER = 'field_option_ident',
  FIELD_CONSTRAINT_IDENTIFIER = 'field_constraint_ident',
  METHOD_CATCH_IDENTIFIER = 'method_catch_ident',
  METHOD_HANDLER_IDENTIFIER = 'method_handler_ident',
  REQUIRED_FIELD_IDENTIFIER = 'required_field_ident',
  SUB_OPTION_IDENTIFIER = 'sub_o_ident',
  VALUE_VALIDATOR_IDENTIFIER = 'value_validator_ident',
  FUNC_MODULE_IDENTIFIER = 'func_module_ident',
  PARAM_INJECT_TOKEN_IDENTIFIER = 'param_inject_token_ident',
  SERVICE_IDENTIFIER = 'service_ident',

  HANDLER_IDENTIFIER = 'handler_ident',
  INJECT_TOKEN_IDENTIFIER = 'inject_t_ident',
  INJECT_INDEX_IDENTIFIER = 'inject_i_ident',
}

export enum handlers {
  COMMAND = 'command',
  MISSING = 'missing',
  MAJOR = 'major',
  ERROR = 'error',
}
