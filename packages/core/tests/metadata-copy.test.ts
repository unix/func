import test from 'ava'
import * as filter from '../src/utils/filter'
import * as utils from './_utils'
import { Command, Option, SubOptions } from '../src/annotations'
import { metadata } from '../src/constants/metadata'

test('option decorator should copy params and keep caller object unchanged', t => {
  const name = utils.random()
  const params: any = { name }
  const target = {}
  Option(params)(target)
  params.name = utils.random()

  const output = Reflect.getMetadata(metadata.OPTION_IDENTIFIER, target)
  t.is(params.type, undefined)
  t.is(output.name, name)
  t.is(output.type, Boolean)
})

test('command decorator should copy params', t => {
  const name = utils.random()
  const params = { name }
  const target = {}
  Command(params)(target)
  params.name = utils.random()

  const output = Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, target)
  t.is(output.name, name)
})

test('sub-options decorator should copy params', t => {
  const name = utils.random()
  const params = [{ name }]
  const target = {}
  SubOptions(params)(target)
  params[0].name = utils.random()

  const output = Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, target)
  t.is(output[0].name, name)
  t.is(output[0].type, Boolean)
})

test('register command data should not mutate command metadata', t => {
  const name = utils.random()
  const target = {}
  Command({ name })(target)
  SubOptions([{ name: utils.random() }])(target)

  const output = filter.commandsToDatas([target as any])
  output[0].name = utils.random()
  output[0].subOptions[0].name = utils.random()

  const command = Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, target)
  const subOptions = Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, target)
  t.is(command.name, name)
  t.not(subOptions[0].name, output[0].subOptions[0].name)
})

test('register option data should not mutate option metadata', t => {
  const name = utils.random()
  const target = {}
  Option({ name })(target)

  const output = filter.optionsToDatas([target as any])
  output[0].name = utils.random()

  const option = Reflect.getMetadata(metadata.OPTION_IDENTIFIER, target)
  t.is(option.name, name)
})
