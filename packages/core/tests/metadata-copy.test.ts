import { expect, random, test } from './_test'
import * as filter from '../src/utils/filter'
import { Command, Option, SubOptions } from '../src/annotations'
import { metadata } from '../src/utils/metadata'

test('option decorator should copy params and keep caller object unchanged', () => {
  const name = random()
  const params: any = { name }
  const target = {}
  Option(params)(target)
  params.name = random()

  const output = Reflect.getMetadata(metadata.OPTION_IDENTIFIER, target)
  expect(params.type).toBeUndefined()
  expect(output.name).toBe(name)
  expect(output.type).toBe(Boolean)
})

test('command decorator should copy params', () => {
  const name = random()
  const params = { name }
  const target = {}
  Command(params)(target)
  params.name = random()

  const output = Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, target)
  expect(output.name).toBe(name)
})

test('sub-options decorator should copy params', () => {
  const name = random()
  const params = [{ name }]
  const target = {}
  SubOptions(params)(target)
  params[0].name = random()

  const output = Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, target)
  expect(output[0].name).toBe(name)
  expect(output[0].type).toBe(Boolean)
})

test('register command data should not mutate command metadata', () => {
  const name = random()
  const target = {}
  Command({ name })(target)
  SubOptions([{ name: random() }])(target)

  const output = filter.commandsToDatas([target as any])
  output[0].name = random()
  output[0].subOptions[0].name = random()

  const command = Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, target)
  const subOptions = Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, target)
  expect(command.name).toBe(name)
  expect(subOptions[0].name).not.toBe(output[0].subOptions[0].name)
})

test('register option data should not mutate option metadata', () => {
  const name = random()
  const target = {}
  Option({ name })(target)

  const output = filter.optionsToDatas([target as any])
  output[0].name = random()

  const option = Reflect.getMetadata(metadata.OPTION_IDENTIFIER, target)
  expect(option.name).toBe(name)
})
