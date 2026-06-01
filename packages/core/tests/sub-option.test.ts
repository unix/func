import { expect, random, test } from './_test'
import { Command, SubOptions } from '../src/annotations'
import { metadata } from '../src/utils/metadata'

test('metadata should be defined', () => {
  const name = random()
  const description = random()
  const alias = random()
  const target = {}
  Command({ name: random() })(target)
  SubOptions([{ name, description, alias }])(target)

  const outputs = Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, target)
  const output = outputs[0]
  expect(output.name).toBe(name)
  expect(output.description).toBe(description)
  expect(output.alias).toBe(alias)
})

test('default type should be Boolean', () => {
  const name = random()
  const target = {}
  Command({ name: random() })(target)
  SubOptions([{ name }])(target)

  const outputs = Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, target)
  const output = outputs[0]
  expect(output.type).toBe(Boolean)
})

test('should get an error when param not array', () => {
  expect(() => {
    const target = {}
    Command({ name: random() })(target)(<any>SubOptions)({ name: random() })(target)
  }).toThrow()
})

test('should get an error when param miss name', () => {
  expect(() => {
    const target = {}
    Command({ name: random() })(target)(<any>SubOptions)([{}])(target)
  }).toThrow()
})
