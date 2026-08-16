export const metadata = {
  COMMAND_IDENTIFIER: Symbol('func.command'),
  HANDLER_IDENTIFIER: Symbol('func.handler'),
  METHOD_DEPRECATION_IDENTIFIER: Symbol('func.method-deprecation'),
  METHOD_HANDLER_IDENTIFIER: Symbol('func.method-handler'),
} as const

export enum handlers {
  COMMAND = 'command',
  MISSING = 'missing',
  MAJOR = 'major',
}
