import 'reflect-metadata/lite'
import * as func from '../src'
import { ErrorScope, Exception, formatExceptionCode } from '../src'
import { InternalException } from '../src/shared/errors'
import { SYSTEM, expect, systemErrorCode, test } from './_test'

test('should not expose legacy error decorators', () => {
  expect(func).not.toHaveProperty('Catch')
  expect(func).not.toHaveProperty('CatchAll')
  expect(func.Exception).toBe(Exception)
  expect(func.ExceptionContext).toBeTypeOf('function')
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

test('should format and serialize overridden error data', () => {
  const cause = new Error('root cause')
  const error = new Exception(SYSTEM.INVALID_TOKEN, {
    cause,
    details: { token: 'name' },
    message: 'Invalid token.',
    scope: ErrorScope.SYSTEM,
  })

  expect(error.code).toBe(systemErrorCode(SYSTEM.INVALID_TOKEN))
  expect(error.toJSON()).toMatchObject({
    cause: { message: 'root cause', name: 'Error' },
    code: 'F_SYSTEM_INVALID_TOKEN',
    details: { token: 'name' },
    message: 'Invalid token.',
    name: 'Exception',
    scope: ErrorScope.SYSTEM,
  })
})

test('should keep internal errors out of the public API', () => {
  expect(func).not.toHaveProperty('InternalException')
  expect(func).not.toHaveProperty('CommandError')
  expect(SYSTEM.INVALID_TOKEN).toBe('INVALID_TOKEN')
  expect(formatExceptionCode(ErrorScope.SYSTEM, SYSTEM.INVALID_TOKEN)).toBe(
    'F_SYSTEM_INVALID_TOKEN',
  )
})
