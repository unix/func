import test from 'ava'
import * as utils from './_utils'
import { Option } from '../src/annotations'
import { metadata, handlers } from '../src/constants/metadata'

test('metadata should be defined', t => {
  const name = utils.random()
  const description = utils.random()
  const alias = utils.random()
  const target = {}
  Option({ name, description, alias })(target)

  const output = Reflect.getMetadata(metadata.OPTION_IDENTIFIER, target)
  t.is(name, output.name)
  t.is(description, output.description)
  t.is(alias, output.alias)
})

test('default type should be Boolean', t => {
  const name = utils.random()
  const target = {}
  Option({ name })(target)

  const output = Reflect.getMetadata(metadata.OPTION_IDENTIFIER, target)
  t.is(Boolean, output.type)
})

test('handler type should be defined', t => {
  const target = {}
  Option({ name: utils.random() })(target)

  const output = Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, target)
  t.not(output, undefined)
  t.is(output, handlers.OPTION)
})

test('should get an error when name is undefined', t => {
  try {
    Option({ name: undefined })({})
    t.fail('param "name" cannot be "undefined"')
  } catch (e) {
    t.pass()
  }
})
