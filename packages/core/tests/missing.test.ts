import test from 'ava'
import { CommandMissing } from '../src/annotations'
import { metadata, handlers } from '../src/constants/metadata'

test('missing should be defined', t => {
  const target = {}
  CommandMissing()(target)

  const output = Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, target)
  t.is(handlers.MISSING, output)
})
