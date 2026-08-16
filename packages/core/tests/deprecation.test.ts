import 'reflect-metadata/lite'
import { Command, Deprecated, Handler, OptionCommand, Value } from '../src'
import { compileMethodHandlers } from '../src/deprecation'
import { compileFieldOptions } from '../src/options/field-metadata'
import { metadata as commandMetadata } from '../src/commands/metadata'
import { metadata as optionMetadata } from '../src/options/metadata'
import { SYSTEM, expect, systemErrorCode, test } from './_test'

test('should normalize command and OptionCommand deprecations', () => {
  @Command({ deprecated: '  Use build instead.  ', path: 'legacy' })
  class LegacyCommand {}

  @OptionCommand({ deprecated: true, name: 'legacy' })
  class LegacyOptionCommand {}

  expect(
    Reflect.getMetadata(commandMetadata.COMMAND_IDENTIFIER, LegacyCommand),
  ).toEqual({
    aliases: [],
    deprecated: 'Use build instead.',
    path: ['legacy'],
  })
  expect(
    Reflect.getMetadata(
      optionMetadata.OPTION_COMMAND_IDENTIFIER,
      LegacyOptionCommand,
    ),
  ).toEqual({
    aliases: [],
    deprecated: true,
    name: 'legacy',
    type: Boolean,
  })
})

test('should deprecate field options independently of decorator order', () => {
  class Options {
    @Deprecated('Use --modern instead.')
    @Value()
    legacy?: string

    @Value()
    @Deprecated()
    older?: string

    @Deprecated()
    ordinary?: string
  }

  expect(compileFieldOptions(Options)).toEqual([
    expect.objectContaining({
      deprecated: 'Use --modern instead.',
      name: 'legacy',
    }),
    expect.objectContaining({ deprecated: true, name: 'older' }),
  ])
})

test('should deprecate flag handlers independently of decorator order', () => {
  class Handlers {
    @Deprecated()
    @Handler({ flag: 'legacy' })
    legacy() {}

    @Handler({ flag: 'older' })
    @Deprecated('Use --modern instead.')
    older() {}

    @Deprecated()
    ordinary() {}
  }

  expect(compileMethodHandlers(Handlers)).toEqual([
    expect.objectContaining({ deprecated: true, flag: 'legacy' }),
    expect.objectContaining({
      deprecated: 'Use --modern instead.',
      flag: 'older',
    }),
  ])
})

test('should reject Deprecated on default and path handlers', () => {
  class DefaultHandlers {
    @Deprecated()
    @Handler()
    run() {}
  }

  class PathHandlers {
    @Deprecated()
    @Handler('run')
    run() {}
  }

  expect(() => compileMethodHandlers(DefaultHandlers)).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_METHOD_DECORATOR_TARGET),
      details: {
        handler: 'run',
        reason: 'deprecated-handler-requires-flag',
      },
    }),
  )
  expect(() => compileMethodHandlers(PathHandlers)).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_METHOD_DECORATOR_TARGET),
      details: {
        handler: 'run',
        reason: 'deprecated-handler-requires-flag',
      },
    }),
  )
})
