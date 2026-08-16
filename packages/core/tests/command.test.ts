import 'reflect-metadata/lite'
import { Command, Handler, createApp } from '../src'
import { handlers, metadata } from '../src/commands/metadata'
import {
  SYSTEM,
  applyClassDecorator,
  expect,
  objectContaining,
  random,
  systemErrorCode,
  test,
  testModule,
} from './_test'

test('should define command metadata and handler type', () => {
  const params = {
    alias: 'b',
    aliases: ['bundle', 'b'],
    description: 'Build the project',
    path: [random(), 'self'],
  }

  @Command(params)
  class BuildCommand {}

  expect(Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, BuildCommand)).toEqual({
    aliases: ['b', 'bundle'],
    description: params.description,
    path: params.path,
  })
  expect(Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, BuildCommand)).toBe(
    handlers.COMMAND,
  )
})

test('should copy command params before storing metadata', () => {
  const original = random()
  const aliases = ['b']
  const path = [original, 'self']
  const params = {
    aliases,
    description: 'Original description',
    path,
  }

  @Command(params)
  class BuildCommand {}

  params.description = 'Changed description'
  aliases[0] = 'changed'
  path[0] = 'changed'

  expect(Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, BuildCommand)).toEqual({
    aliases: ['b'],
    description: 'Original description',
    path: [original, 'self'],
  })
})

test('should normalize string command paths', () => {
  @Command('build')
  class BuildCommand {}

  expect(Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, BuildCommand)).toEqual({
    aliases: [],
    path: ['build'],
  })
})

test('should reject invalid command paths and aliases', () => {
  expect(() => {
    @Command('-build')
    class InvalidNameCommand {}

    return InvalidNameCommand
  }).toThrow(
    expect.objectContaining({ code: systemErrorCode(SYSTEM.INVALID_TOKEN) }),
  )

  expect(() => {
    @Command({ path: random(), alias: 'bad alias' })
    class InvalidAliasCommand {}

    return InvalidAliasCommand
  }).toThrow(
    expect.objectContaining({ code: systemErrorCode(SYSTEM.INVALID_TOKEN) }),
  )

  expect(() => {
    @Command({ path: random(), aliases: ['valid', '-invalid'] })
    class InvalidAliasesCommand {}

    return InvalidAliasesCommand
  }).toThrow(
    expect.objectContaining({ code: systemErrorCode(SYSTEM.INVALID_TOKEN) }),
  )

  expect(() => {
    class NonArrayAliasesCommand {}
    applyClassDecorator(
      Command,
      { aliases: 'invalid', path: random() },
      NonArrayAliasesCommand,
    )

    return NonArrayAliasesCommand
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.EXPECTED_ARRAY_PARAM),
    }),
  )
})

test('should require a non-empty command path', () => {
  expect(() => {
    @Command('')
    class MissingNameCommand {}

    return MissingNameCommand
  }).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.MISSING_REQUIRED_PARAM),
    }),
  )
})

test('should require subclasses to declare a command role while inheriting handlers', () => {
  @Command('base')
  class BaseCommand {
    @Handler()
    run() {}
  }

  class UndecoratedCommand extends BaseCommand {}

  expect(() => createApp(testModule({ commands: [UndecoratedCommand] }))).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.UNKNOWN_HANDLER),
      details: { handlers: ['UndecoratedCommand'] },
    }),
  )

  @Command('child')
  class ChildCommand extends BaseCommand {}

  expect(() => createApp(testModule({ commands: [ChildCommand] }))).not.toThrow()
})

test('should reject duplicate command tokens', () => {
  @Command('build')
  class FirstBuildCommand {
    @Handler()
    run() {}
  }

  @Command(['build'])
  class SecondBuildCommand {
    @Handler()
    run() {}
  }

  expect(() =>
    createApp(testModule({ commands: [FirstBuildCommand, SecondBuildCommand] })),
  ).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.DUPLICATE_COMMAND_TOKEN),
    }),
  )

  @Command({ aliases: ['d', 'run'], path: 'deploy' })
  class DeployCommand {
    @Handler()
    run() {}
  }

  @Command('run')
  class RunCommand {
    @Handler()
    run() {}
  }

  expect(() =>
    createApp(testModule({ commands: [DeployCommand, RunCommand] })),
  ).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.DUPLICATE_COMMAND_TOKEN),
      details: objectContaining({ token: 'run' }),
    }),
  )
})
