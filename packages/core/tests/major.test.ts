import 'reflect-metadata'
import { CommandMajor } from '../src'
import { handlers, metadata } from '../src/utils/metadata'
import { expect, test } from './_test'

test('should mark a class as major command handler', () => {
  @CommandMajor()
  class MajorCommand {}

  expect(Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, MajorCommand)).toBe(handlers.MAJOR)
})

