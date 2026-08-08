import 'reflect-metadata'
import { Catch, CommandError, F_SYSTEM } from '../src'
import { handlers, metadata } from '../src/utils/metadata'
import { expect, test } from './_test'

test('should mark a class as command error handler', () => {
  @CommandError()
  class ErrorHandler {}

  expect(Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, ErrorHandler)).toBe(
    handlers.ERROR,
  )
})

test('should keep legacy system error codes public', () => {
  expect(F_SYSTEM).toMatchObject({
    DUPLICATE_HANDLER: 'F_SYSTEM_DUPLICATE_HANDLER',
    INVALID_PARAM_TYPE: 'F_SYSTEM_INVALID_PARAM_TYPE',
    INVALID_PARAM_VALUE: 'F_SYSTEM_INVALID_PARAM_VALUE',
  })
})

test('should reject invalid catch targets', () => {
  expect(() => {
    class ErrorHandler {
      @Catch()
      static handle() {}
    }

    return ErrorHandler
  }).toThrow(
    expect.objectContaining({ code: F_SYSTEM.INVALID_METHOD_DECORATOR_TARGET }),
  )
})
