import 'reflect-metadata'
import {
  ArrayValue,
  F_SYSTEM,
  Flag,
  Required,
  Value,
  ValueValidate,
} from '../src'
import { metadata } from '../src/utils/metadata'
import { expect, test } from './_test'

test('should collect flag, value, and array field options', () => {
  class Options {
    @Flag({ alias: 'v', description: 'Verbose output' })
    verbose = false

    @Value({ name: 'config', alias: 'c' })
    file: string = 'func.config.ts'

    @ArrayValue({ name: 'include' })
    includes: string[] = []
  }

  expect(Reflect.getMetadata(metadata.FIELD_OPTION_IDENTIFIER, Options)).toEqual([
    {
      kind: 'flag',
      name: 'verbose',
      propertyKey: 'verbose',
      required: false,
      type: Boolean,
      alias: 'v',
      description: 'Verbose output',
    },
    {
      kind: 'value',
      name: 'config',
      propertyKey: 'file',
      required: false,
      type: String,
      alias: 'c',
    },
    {
      kind: 'array',
      name: 'include',
      propertyKey: 'includes',
      required: false,
      type: [String],
    },
  ])
})

test('should infer primitive value types and allow explicit value type', () => {
  class Options {
    @Value()
    count: number = 1

    @Value()
    enabled: boolean = false

    @Value({ type: [String] })
    tags: string[] = []
  }

  expect(Reflect.getMetadata(metadata.FIELD_OPTION_IDENTIFIER, Options)).toEqual([
    expect.objectContaining({ name: 'count', type: Number }),
    expect.objectContaining({ name: 'enabled', type: Boolean }),
    expect.objectContaining({ name: 'tags', type: [String] }),
  ])
})

test('should reject invalid field targets and invalid option params', () => {
  expect(() => {
    class StaticOptions {
      @Flag()
      static verbose = false
    }

    return StaticOptions
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_PARAM_TYPE }))

  expect(() => {
    class InvalidNameOptions {
      @Value({ name: '-config' })
      config: string = ''
    }

    return InvalidNameOptions
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_PARAM_VALUE }))

  expect(() => {
    class InvalidAliasOptions {
      @Flag({ alias: 'vv' })
      verbose = false
    }

    return InvalidAliasOptions
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_PARAM_VALUE }))
})

test('should require explicit type when value type cannot be inferred', () => {
  expect(() => {
    class Options {
      @Value()
      when: Date = new Date()
    }

    return Options
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_PARAM_TYPE }))
})

test('should mark existing and future field options as required', () => {
  class Options {
    @Required()
    @Value()
    existing?: string

    @Value()
    @Required()
    future?: string
  }

  expect(Reflect.getMetadata(metadata.REQUIRED_FIELD_IDENTIFIER, Options)).toEqual([
    'existing',
    'future',
  ])
  expect(Reflect.getMetadata(metadata.FIELD_OPTION_IDENTIFIER, Options)).toEqual([
    expect.objectContaining({ name: 'existing', required: true }),
    expect.objectContaining({ name: 'future', required: true }),
  ])
})

test('should collect validators by field property key', () => {
  const positive = (value: unknown) => Number(value) > 0
  const integer = (value: unknown) => Number.isInteger(Number(value))

  class Options {
    @ValueValidate(positive)
    @ValueValidate(integer)
    @Value()
    port: number = 3000
  }

  expect(Reflect.getMetadata(metadata.VALUE_VALIDATOR_IDENTIFIER, Options)).toEqual({
    port: [integer, positive],
  })
})
