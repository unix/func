export const metadata = {
  COMMAND_IDENTIFIER: Symbol('func.command'),
  DESIGN_PARAM_TYPES: 'design:paramtypes',
  DESIGN_TYPE: 'design:type',
  FIELD_OPTION_IDENTIFIER: Symbol('func.field-option'),
  HANDLER_IDENTIFIER: Symbol('func.handler'),
  INJECTABLE_IDENTIFIER: Symbol('func.di.injectable'),
  METHOD_DEPRECATION_IDENTIFIER: Symbol('func.method-deprecation'),
  METHOD_HANDLER_IDENTIFIER: Symbol('func.method-handler'),
  MODULE_IDENTIFIER: Symbol('func.di.module'),
  OPTION_COMMAND_IDENTIFIER: Symbol('func.option-command'),
  OPTION_IDENTIFIER: Symbol('func.option'),
  PARAMETER_TOKENS_IDENTIFIER: Symbol('func.di.parameter-tokens'),
} as const

export enum handlers {
  COMMAND = 'command',
  MISSING = 'missing',
  MAJOR = 'major',
}
