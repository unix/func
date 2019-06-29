import test from 'ava'
import { CommandNotFound, CommandMissing } from '../src/annotations'
import { metadata, handlers } from '../src/constants/metadata'

test('handler type should be defined', t => {
  const target = {}
  CommandNotFound()(target)
  
  const output = Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, target)
  t.is(handlers.MISSING, output)
})

test('missing should be defined', t => {
  const target = {}
  CommandMissing()(target)
  
  const output = Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, target)
  t.is(handlers.MISSING, output)
})
