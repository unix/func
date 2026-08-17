import 'reflect-metadata/lite'
import {
  Exception as ContractException,
  isException as isContractException,
} from '@func/contracts/exception'
import { SCAFFOLD, ScaffoldException } from '@func/contracts/scaffold-errors'
import * as func from '../src'
import { ErrorScope, Exception, formatExceptionCode } from '../src'
import { InternalException } from '../src/shared/errors'
import { SYSTEM, expect, systemErrorCode, test } from './_test'

test('should expose filter decorators without legacy error context', () => {
  expect(func.Catch).toBeTypeOf('function')
  expect(func).not.toHaveProperty('CatchAll')
  expect(func.Exception).toBe(Exception)
  expect(func).not.toHaveProperty('ExceptionContext')
})

test('should create a runtime exception from only a code', () => {
  const error = new Exception('CUSTOM_FAILURE')

  expect(error).toMatchObject({
    code: 'F_RUNTIME_CUSTOM_FAILURE',
    details: {},
    message: 'F_RUNTIME_CUSTOM_FAILURE',
    name: 'Exception',
    scope: ErrorScope.RUNTIME,
  })
})

test('should accept a message as the second parameter', () => {
  const error = new Exception('CUSTOM_FAILURE', 'Custom failure.')
  const internalError = new InternalException(SYSTEM.INVALID_TOKEN, 'Invalid token.')
  expect(error.message).toBe('Custom failure.')
  expect(internalError).toMatchObject({
    code: 'F_SYSTEM_INVALID_TOKEN',
    message: 'Invalid token.',
    name: 'InternalException',
    scope: ErrorScope.SYSTEM,
  })
})

test('should expose error data without defining a JSON wire format', () => {
  const cause = new Error('root cause')
  const error = new Exception(SYSTEM.INVALID_TOKEN, {
    cause,
    details: { token: 'name' },
    message: 'Invalid token.',
    scope: ErrorScope.SYSTEM,
  })

  expect(error.code).toBe(systemErrorCode(SYSTEM.INVALID_TOKEN))
  expect(error).toMatchObject({
    cause,
    code: 'F_SYSTEM_INVALID_TOKEN',
    details: { token: 'name' },
    message: 'Invalid token.',
    name: 'Exception',
    scope: ErrorScope.SYSTEM,
  })
  expect(error).not.toHaveProperty('toJSON')
})

test('should keep internal errors out of the public API', () => {
  expect(func).not.toHaveProperty('InternalException')
  expect(func).not.toHaveProperty('CommandError')
  expect(SYSTEM.INVALID_TOKEN).toBe('INVALID_TOKEN')
  expect(formatExceptionCode(ErrorScope.SYSTEM, SYSTEM.INVALID_TOKEN)).toBe(
    'F_SYSTEM_INVALID_TOKEN',
  )
})

test('should recognize contract exceptions across bundled copies', () => {
  const externalError = Object.assign(new Error('External failure.'), {
    code: 'F_RUNTIME_EXTERNAL_FAILURE',
    details: {},
    scope: 'F_RUNTIME',
  })
  Object.defineProperty(externalError, Symbol.for('func-exception'), {
    value: true,
  })

  expect(isContractException(externalError)).toBe(true)
  expect(func.isException(externalError)).toBe(true)
  expect(new Exception('CUSTOM_FAILURE')).toBeInstanceOf(ContractException)
})

test('should keep scaffold exceptions outside the func error scopes', () => {
  const error = new ScaffoldException(SCAFFOLD.ENTRY_NOT_FOUND)
  expect(isContractException(error)).toBe(true)
  expect(func.isException(error)).toBe(false)
  expect(error.code).toBe('F_SCAFFOLD_ENTRY_NOT_FOUND')
})
