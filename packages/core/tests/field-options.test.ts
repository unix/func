import 'reflect-metadata/lite'
import {
  ArrayNumber,
  ArrayString,
  Enum,
  Flag,
  Required,
  Value,
  ValueValidate,
  createValueDecorator,
} from '../src'
import { compileFieldOptions } from '../src/options/field-metadata'
import { SYSTEM, expect, objectContaining, systemErrorCode, test } from './_test'

test('should collect flag, value, and array field options', () => {
  class Options {
    @Flag({
      alias: 'v',
      aliases: ['V', 'v'],
      description: 'Verbose output',
      negatable: true,
    })
    verbose = false

    @Value({ name: 'config', aliases: ['c', 'C'] })
    file: string = 'func.config.ts'

    @ArrayString({ name: 'include', aliases: ['i', 'I'] })
    includes: string[] = []
  }

  expect(compileFieldOptions(Options)).toEqual([
    {
      kind: 'flag',
      name: 'verbose',
      propertyKey: 'verbose',
      required: false,
      type: Boolean,
      aliases: ['v', 'V'],
      description: 'Verbose output',
      negatable: true,
      validators: [],
    },
    {
      kind: 'value',
      name: 'config',
      propertyKey: 'file',
      required: false,
      type: String,
      aliases: ['c', 'C'],
      validators: [],
    },
    {
      aliases: ['i', 'I'],
      kind: 'array',
      name: 'include',
      propertyKey: 'includes',
      required: false,
      type: [String],
      validators: [],
    },
  ])
})

test('should accept field option names as strings', () => {
  class Options {
    @Flag('dry-run')
    dryRun = false

    @Value('config-file')
    configFile: string = ''

    @ArrayString('tag')
    tags: string[] = []

    @ArrayNumber('port')
    ports: number[] = []
  }

  expect(compileFieldOptions(Options)).toEqual([
    expect.objectContaining({
      kind: 'flag',
      name: 'dry-run',
      propertyKey: 'dryRun',
      type: Boolean,
    }),
    expect.objectContaining({
      kind: 'value',
      name: 'config-file',
      propertyKey: 'configFile',
      type: String,
    }),
    expect.objectContaining({
      kind: 'array',
      name: 'tag',
      propertyKey: 'tags',
      type: [String],
    }),
    expect.objectContaining({
      kind: 'array',
      name: 'port',
      propertyKey: 'ports',
      type: [Number],
    }),
  ])
})

test('should infer scalar types and collect typed arrays', () => {
  class Options {
    @Value()
    count: number = 1

    @Value()
    name: string = 'func'

    @ArrayNumber()
    ports: number[] = []
  }

  expect(compileFieldOptions(Options)).toEqual([
    expect.objectContaining({ name: 'count', type: Number }),
    expect.objectContaining({ name: 'name', type: String }),
    expect.objectContaining({ name: 'ports', type: [Number] }),
  ])
})

test('should create transformed value field options with string input', () => {
  const transform = (input: string) => new URL(input)
  const Url = createValueDecorator(transform)

  class Options {
    @Url({ alias: 'u', name: 'endpoint' })
    url!: URL
  }

  expect(compileFieldOptions(Options)).toEqual([
    expect.objectContaining({
      aliases: ['u'],
      kind: 'value',
      name: 'endpoint',
      propertyKey: 'url',
      transform,
      type: String,
    }),
  ])
})

test('should reject boolean types for @Value', () => {
  expect(() => {
    class InferredBoolean {
      @Value()
      enabled: boolean = false
    }

    return InferredBoolean
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_OPTION_TYPE),
      details: {
        className: 'InferredBoolean',
        property: 'enabled',
        type: 'Boolean',
      },
      message: systemErrorCode(SYSTEM.INVALID_OPTION_TYPE),
    }),
  )
})

test('should reject array types for @Value', () => {
  expect(() => {
    class Options {
      @Value()
      tags: string[] = []
    }

    return Options
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_OPTION_TYPE),
      details: {
        className: 'Options',
        property: 'tags',
        type: 'Array',
      },
      message: systemErrorCode(SYSTEM.INVALID_OPTION_TYPE),
    }),
  )
})

test('should reject non-array fields for array decorators', () => {
  expect(() => {
    class Options {
      @ArrayNumber()
      count: number = 0
    }

    return Options
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_OPTION_TYPE),
      details: {
        className: 'Options',
        expectedType: 'number[]',
        property: 'count',
        type: 'Number',
      },
      message: systemErrorCode(SYSTEM.INVALID_OPTION_TYPE),
    }),
  )
})

test('should require explicit array property types', () => {
  expect(() => {
    class Options {
      @ArrayString()
      values = []
    }

    return Options
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.CANNOT_INFER_VALUE_TYPE),
      details: objectContaining({
        className: 'Options',
        expectedType: 'string[]',
        property: 'values',
      }),
    }),
  )
})

test('should reject object metadata when scalar types cannot be inferred', () => {
  expect(() => {
    class Options {
      @Value()
      name = 'func'
    }

    return Options
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.CANNOT_INFER_VALUE_TYPE),
      details: objectContaining({
        className: 'Options',
        expectedType: 'string or number',
        property: 'name',
      }),
    }),
  )
})

test('should reject invalid field targets and invalid option params', () => {
  expect(() => {
    class StaticOptions {
      @Flag()
      static verbose = false
    }

    return StaticOptions
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_FIELD_DECORATOR_TARGET),
    }),
  )

  expect(() => {
    class InvalidNameOptions {
      @Value('-config')
      config: string = ''
    }

    return InvalidNameOptions
  }).toThrow(
    expect.objectContaining({ code: systemErrorCode(SYSTEM.INVALID_TOKEN) }),
  )

  expect(() => {
    class InvalidAliasOptions {
      @Flag({ alias: 'vv' })
      verbose = false
    }

    return InvalidAliasOptions
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_OPTION_ALIAS),
    }),
  )

  expect(() => {
    class InvalidAliasesOptions {
      @Flag({ aliases: ['v', 'verbose'] })
      verbose = false
    }

    return InvalidAliasesOptions
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_OPTION_ALIAS),
    }),
  )

  expect(() => {
    class InvalidEqualsNameOptions {
      @Value('config=value')
      config: string = ''
    }

    return InvalidEqualsNameOptions
  }).toThrow(
    expect.objectContaining({ code: systemErrorCode(SYSTEM.INVALID_TOKEN) }),
  )

  expect(() => {
    class InvalidNumericAliasOptions {
      @Flag({ alias: '1' })
      verbose = false
    }

    return InvalidNumericAliasOptions
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_OPTION_ALIAS),
    }),
  )
})

test('should require a supported property type when value type cannot be inferred', () => {
  expect(() => {
    class Options {
      @Value()
      when: Date = new Date()
    }

    return Options
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.CANNOT_INFER_VALUE_TYPE),
      details: objectContaining({
        className: 'Options',
        expectedType: 'string or number',
        property: 'when',
        reason: 'cannot-infer-value-type',
      }),
      message: systemErrorCode(SYSTEM.CANNOT_INFER_VALUE_TYPE),
    }),
  )
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

  expect(compileFieldOptions(Options)).toEqual([
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

  expect(compileFieldOptions(Options)).toEqual([
    expect.objectContaining({
      name: 'port',
      validators: [integer, positive],
    }),
  ])
})

test('should isolate inherited field metadata updates', () => {
  const validate = () => true

  class BaseOptions {
    @ValueValidate(validate)
    @Value()
    mode: string = 'dev'
  }

  class ChildOptions extends BaseOptions {}
  Required()(ChildOptions.prototype, 'mode')
  Enum(['prod'])(ChildOptions.prototype, 'mode')
  const baseFields = compileFieldOptions(BaseOptions)
  expect(baseFields).toEqual([
    expect.objectContaining({
      name: 'mode',
      required: false,
      validators: [validate],
    }),
  ])
  expect(baseFields[0]).not.toHaveProperty('enum')
  expect(compileFieldOptions(ChildOptions)).toEqual([
    expect.objectContaining({
      enum: ['prod'],
      name: 'mode',
      required: true,
      validators: [validate],
    }),
  ])
})
