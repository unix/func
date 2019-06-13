import test from 'ava'
import * as utils from './_utils'
import { Command, SubOptions } from '../src/annotations'
import { metadata } from '../src/constants/metadata'

test('metadata should be defined', t => {
  const name = utils.random()
  const description = utils.random()
  const alias = utils.random()
  const target = {}
  Command({ name: utils.random() })(target)
  SubOptions([{ name, description, alias }])(target)
  
  const outputs = Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, target)
  const output = outputs[0]
  t.is(name, output.name)
  t.is(description, output.description)
  t.is(alias, output.alias)
})

test('default type should be Boolean', t => {
  const name = utils.random()
  const target = {}
  Command({ name: utils.random() })(target)
  SubOptions([{ name }])(target)
  
  const outputs = Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, target)
  const output = outputs[0]
  t.is(Boolean, output.type)
})

test('should get an error when param not array', t => {
  try {
    const target = {}
    Command({ name: utils.random() })(target)
    (<any>SubOptions)({ name: utils.random() })(target)
    t.fail('param "SubOptions Params" must be "Array"')
  } catch (e) {
    t.pass()
  }
})

test('should get an error when param miss name', t => {
  try {
    const target = {}
    Command({ name: utils.random() })(target)
    (<any>SubOptions)([{}])(target)
    t.fail('param "SubOptions name" missing')
  } catch (e) {
    t.pass()
  }
})
