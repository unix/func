import { expect, random, test } from './_test'
import { Option } from '../src/annotations'
import { metadata, handlers } from '../src/utils/metadata'

test('metadata should be defined', () => {
  const name = random()
  const description = random()
  const alias = random()
  const target = {}
  Option({ name, description, alias })(target)

  const output = Reflect.getMetadata(metadata.OPTION_IDENTIFIER, target)
  expect(output.name).toBe(name)
  expect(output.description).toBe(description)
  expect(output.alias).toBe(alias)
})

test('default type should be Boolean', () => {
  const name = random()
  const target = {}
  Option({ name })(target)

  const output = Reflect.getMetadata(metadata.OPTION_IDENTIFIER, target)
  expect(output.type).toBe(Boolean)
})

test('handler type should be defined', () => {
  const target = {}
  Option({ name: random() })(target)

  const output = Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, target)
  expect(output).toBeDefined()
  expect(output).toBe(handlers.OPTION)
})

test('should get an error when name is undefined', () => {
  expect(() => Option({ name: undefined })({})).toThrow()
})
