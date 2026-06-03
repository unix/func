import 'reflect-metadata'
import { CommandMissing } from '../src'
import { handlers, metadata } from '../src/utils/metadata'
import { expect, test } from './_test'

test('should mark a class as missing command handler', () => {
  @CommandMissing()
  class MissingHandler {}

  expect(Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, MissingHandler)).toBe(handlers.MISSING)
})

