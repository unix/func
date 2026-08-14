import 'reflect-metadata/lite'
import { ArrayValue, Enum, Flag, Required, Value, ValueValidate } from '../src'
import { compileFieldOptions } from '../src/options/field-metadata'
import { SYSTEM, expect, systemErrorCode, test } from './_test'

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

    @ArrayValue({ name: 'include', aliases: ['i', 'I'] })
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

test('should infer scalar types and allow explicit value types', () => {
  class Options {
    @Value()
    count: number = 1

    @Value({ type: String })
    name: unknown = 'func'

    @ArrayValue({ type: Number })
    ports: number[] = []
  }

  expect(compileFieldOptions(Options)).toEqual([
    expect.objectContaining({ name: 'count', type: Number }),
    expect.objectContaining({ name: 'name', type: String }),
    expect.objectContaining({ name: 'ports', type: [Number] }),
  ])
})

test('should reject explicit and inferred boolean types for @Value', () => {
  expect(() => {
    class ExplicitBoolean {
      // @ts-expect-error Boolean options must use @Flag.
      @Value({ type: Boolean })
      enabled: unknown = false
    }

    return ExplicitBoolean
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_OPTION_TYPE),
      details: {
        className: 'ExplicitBoolean',
        property: 'enabled',
        type: 'Boolean',
      },
      message:
        '@Value type "Boolean" is unsupported. Use String or Number. Use @Flag for boolean options.',
    }),
  )

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
    }),
  )
})

test('should reject explicit and inferred array types for @Value', () => {
  const invalidTypes = [Array, [String]]

  invalidTypes.forEach(type => {
    expect(() => {
      class Options {
        // @ts-expect-error Runtime validation protects JavaScript callers too.
        @Value({ type })
        tags: string[] = []
      }

      return Options
    }).toThrow(
      expect.objectContaining({
        code: systemErrorCode(SYSTEM.INVALID_OPTION_TYPE),
        details: expect.objectContaining({
          className: 'Options',
          property: 'tags',
        }),
      }),
    )
  })

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
    }),
  )
})

test('should reject unsupported explicit types for @ArrayValue', () => {
  expect(() => {
    class Options {
      // @ts-expect-error Boolean arrays are unsupported.
      @ArrayValue({ type: Boolean })
      enabled: boolean[] = []
    }

    return Options
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_OPTION_TYPE),
      details: {
        className: 'Options',
        property: 'enabled',
        type: 'Boolean',
      },
      message:
        '@ArrayValue type "Boolean" is unsupported. Use String or Number. Use @Flag for boolean options.',
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
      @Value({ name: '-config' })
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
})

test('should require explicit type when value type cannot be inferred', () => {
  expect(() => {
    class Options {
      @Value()
      when: Date = new Date()
    }

    return Options
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.CANNOT_INFER_VALUE_TYPE),
      details: expect.objectContaining({
        className: 'Options',
        property: 'when',
        reason: 'cannot-infer-value-type',
      }),
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
