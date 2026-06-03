import 'reflect-metadata'
import { F_SYSTEM, SubOptions } from '../src'
import { metadata } from '../src/utils/metadata'
import { expect, test } from './_test'

test('should define sub-options with Boolean as the default type', () => {
  @SubOptions([
    { name: 'dry-run', alias: 'd', description: 'Skip writes' },
    { name: 'count', type: Number },
  ])
  class BuildCommand {}

  expect(Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, BuildCommand)).toEqual([
    {
      name: 'dry-run',
      alias: 'd',
      description: 'Skip writes',
      type: Boolean,
    },
    {
      name: 'count',
      type: Number,
    },
  ])
})

test('should reject invalid sub-options params', () => {
  expect(() => {
    @SubOptions({ name: 'dry-run' } as any)
    class InvalidOptionsCommand {}

    return InvalidOptionsCommand
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_PARAM_TYPE }))

  expect(() => {
    @SubOptions([{ name: '-dry-run' }])
    class InvalidNameCommand {}

    return InvalidNameCommand
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_PARAM_VALUE }))

  expect(() => {
    @SubOptions([{ name: 'dry-run', alias: 'dry' }])
    class InvalidAliasCommand {}

    return InvalidAliasCommand
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_PARAM_VALUE }))
})

