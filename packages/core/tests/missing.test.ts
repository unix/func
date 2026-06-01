import { expect, test } from './_test'
import { CommandMissing } from '../src/annotations'
import { metadata, handlers } from '../src/utils/metadata'

test('missing should be defined', () => {
  const target = {}
  CommandMissing()(target)

  const output = Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, target)
  expect(output).toBe(handlers.MISSING)
})
