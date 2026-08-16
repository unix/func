import { SYSTEM } from '@func/contracts/core-errors'
import type { HandlerParams } from '../types'
import { InternalException } from '../../shared/errors'
import { handlers } from '../metadata'
import type { HandlerRecord, HandlerRegistry } from './registry'

export const validateRegistration = (registry: HandlerRegistry) => {
  validateKnownHandlers(registry)
  validateSpecialCount(registry.majors(), SYSTEM.MULTIPLE_MAJOR_COMMANDS, 'major')
  validateSpecialCount(
    registry.missing(),
    SYSTEM.MULTIPLE_MISSING_COMMANDS,
    'missing',
  )
  registry
    .commands()
    .concat(registry.majors())
    .concat(registry.missing())
    .forEach(validateCommandShape)
}

const validateKnownHandlers = (registry: HandlerRegistry) => {
  if (!registry.invalidHandlers.length) return
  const names = registry.invalidHandlers.map(
    record => record.handler.name || '<anonymous>',
  )
  throw new InternalException(SYSTEM.UNKNOWN_HANDLER, {
    details: { handlers: names },
    message: `All handlers passed to Container must use a func decorator: ${names.join(', ')}.`,
  })
}

const validateSpecialCount = (
  records: HandlerRecord[],
  code: SYSTEM.MULTIPLE_MAJOR_COMMANDS | SYSTEM.MULTIPLE_MISSING_COMMANDS,
  kind: 'major' | 'missing',
) => {
  if (records.length <= 1) return
  const names = records.map(record => record.handler.name)
  throw new InternalException(code, {
    details: { handlers: names, scope: 'command' },
    message: `Only one ${kind} command can be registered: ${names.join(', ')}.`,
  })
}

const validateCommandShape = (record: HandlerRecord) => {
  const methodHandlers = record.methodHandlers
  if (!methodHandlers.length) {
    throw new InternalException(SYSTEM.MISSING_HANDLER, {
      details: { handler: record.handler.name },
      message: `Command "${record.handler.name}" must define at least one @Handler method.`,
    })
  }

  const defaults = methodHandlers.filter(isDefaultHandler)
  if (record.kind === handlers.COMMAND || defaults.length <= 1) return
  throw new InternalException(SYSTEM.MULTIPLE_DEFAULT_HANDLERS, {
    details: {
      handler: record.handler.name,
      methods: defaults.map(handler => handler.methodName),
    },
    message: `Command "${record.handler.name}" must define only one default @Handler method.`,
  })
}

const isDefaultHandler = (handler: HandlerParams): boolean =>
  !handler.flag && !handler.path.length
