const assert = require('node:assert/strict')
const func = require('func')

const systemError = func.createSystemError(
  func.F_SYSTEM.INVALID_PARAM_VALUE,
  func.errorTypes.DEFINITION,
  'system probe',
  { source: 'ecosystem' },
)
assert.ok(systemError instanceof func.FuncError)
assert.equal(func.isFuncError(systemError), true)
assert.equal(systemError.level, func.errorLevels.SYSTEM)
assert.equal(systemError.details.source, 'ecosystem')
assert.throws(
  () => func.handleSystemError(systemError),
  error => error === systemError,
)

const runtimeError = func.createRuntimeError(
  func.F_RUNTIME.HANDLER_ERROR,
  func.errorTypes.HANDLER,
  'runtime probe',
)
assert.equal(runtimeError.level, func.errorLevels.RUNTIME)
assert.equal(func.normalizeRuntimeError(runtimeError), runtimeError)
assert.equal(
  func.normalizeRuntimeError(new Error('native probe')).message,
  'native probe',
)

const printError = func.createRuntimePrintError(
  func.F_RUNTIME_PRINT.VALIDATION,
  func.errorTypes.INPUT,
  'print probe',
)
const exception = new func.FuncException(printError)
assert.equal(exception.code, func.F_RUNTIME_PRINT.VALIDATION)
assert.equal(exception.error, printError)
assert.equal(exception.level, func.errorLevels.RUNTIME_PRINT)
assert.equal(exception.message, 'print probe')
assert.equal(exception.type, func.errorTypes.INPUT)
assert.equal(exception.printPrevented, false)
exception.preventDefaultPrint()
assert.equal(exception.printPrevented, true)

const registry = new func.CommandRegistry([{ name: 'probe' }])
assert.deepEqual(registry.commands, [{ name: 'probe' }])
assert.ok(func.createApp({ commands: [] }) instanceof func.Container)

const warnings = []
const errors = []
const originalWarn = console.warn
const originalError = console.error
console.warn = message => warnings.push(message)
console.error = message => errors.push(message)
const effectError = func.handleEffect(
  func.F_EFFECT.DEPRECATED_API,
  func.errorTypes.DEPRECATION,
  'effect probe',
)
func.handleRuntimePrintError(printError, false)
func.handleRuntimePrintError(printError, true)
console.warn = originalWarn
console.error = originalError
assert.equal(effectError.level, func.errorLevels.EFFECT)
assert.deepEqual(warnings, ['effect probe'])
assert.deepEqual(errors, ['print probe'])

class LegacyErrorCommand {}
func.CommandError()(LegacyErrorCommand)

console.log(
  JSON.stringify({
    commandScope: func.errorScopes.COMMAND,
    legacyDecorator: typeof func.CommandError,
    optionToken: func.errorTokenTypes.OPTION_NAME,
    status: 'ok',
  }),
)
