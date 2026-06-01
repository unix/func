import test from 'ava'
import * as utils from './_utils'
import { Command } from '../src/annotations'
import { metadata, handlers } from '../src/constants/metadata'

test('metadata should be defined', t => {
  const name = utils.random()
  const description = utils.random()
  const target = {}
  Command({ name, description })(target)

  const output = Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, target)
  t.is(name, output.name)
  t.is(description, output.description)
})

test('handler type should be defined', t => {
  const target = {}
  Command({ name: utils.random() })(target)

  const output = Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, target)
  t.is(handlers.COMMAND, output)
})

test('should get an error when name is undefined', t => {
  try {
    Command({ name: undefined })({})
    t.fail('param "name" cannot be "undefined"')
  } catch (e) {
    t.pass()
  }
})
