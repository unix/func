import { expect, random, test } from './_test'
import { Command } from '../src/annotations'
import { metadata, handlers } from '../src/constants/metadata'

test('metadata should be defined', () => {
  const name = random()
  const description = random()
  const target = {}
  Command({ name, description })(target)

  const output = Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, target)
  expect(output.name).toBe(name)
  expect(output.description).toBe(description)
})

test('handler type should be defined', () => {
  const target = {}
  Command({ name: random() })(target)

  const output = Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, target)
  expect(output).toBe(handlers.COMMAND)
})

test('should get an error when name is undefined', () => {
  expect(() => Command({ name: undefined })({})).toThrow()
})
