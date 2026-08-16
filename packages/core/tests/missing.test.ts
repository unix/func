import 'reflect-metadata/lite'
import { CommandMissing } from '../src'
import { handlers, metadata } from '../src/commands/metadata'
import { expect, test } from './_test'

test('should mark a class as missing command handler', () => {
  @CommandMissing()
  class MissingHandler {}

  expect(Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, MissingHandler)).toBe(
    handlers.MISSING,
  )
})
