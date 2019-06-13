import test from 'ava'
import { CommandMajor } from '../src/annotations'
import { metadata, handlers } from '../src/constants/metadata'


test('handler type should be defined', t => {
  const target = {}
  CommandMajor()(target)
  
  const output = Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, target)
  t.is(handlers.MAJOR, output)
})
