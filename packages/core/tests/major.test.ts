import { expect, test } from './_test'
import { CommandMajor } from '../src/annotations'
import { metadata, handlers } from '../src/utils/metadata'

test('handler type should be defined', () => {
  const target = {}
  CommandMajor()(target)

  const output = Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, target)
  expect(output).toBe(handlers.MAJOR)
})
