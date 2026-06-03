import 'reflect-metadata'
import { CommandError } from '../src'
import { handlers, metadata } from '../src/utils/metadata'
import { expect, test } from './_test'

test('should mark a class as command error handler', () => {
  @CommandError()
  class ErrorHandler {}

  expect(Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, ErrorHandler)).toBe(handlers.ERROR)
})

