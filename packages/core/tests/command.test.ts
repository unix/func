import 'reflect-metadata'
import { Command, Container, F_SYSTEM, Handler } from '../src'
import { handlers, metadata } from '../src/utils/metadata'
import { expect, random, test } from './_test'

test('should define command metadata and handler type', () => {
  const params = {
    name: random(),
    alias: 'b',
    description: 'Build the project',
  }

  @Command(params)
  class BuildCommand {}

  expect(Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, BuildCommand)).toEqual(
    params,
  )
  expect(Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, BuildCommand)).toBe(
    handlers.COMMAND,
  )
})

test('should copy command params before storing metadata', () => {
  const params = {
    name: random(),
    description: 'Original description',
  }

  @Command(params)
  class BuildCommand {}

  params.description = 'Changed description'

  expect(Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, BuildCommand)).toEqual({
    name: params.name,
    description: 'Original description',
  })
})

test('should reject invalid command name and alias', () => {
  expect(() => {
    @Command({ name: '-build' })
    class InvalidNameCommand {}

    return InvalidNameCommand
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_TOKEN }))

  expect(() => {
    @Command({ name: random(), alias: 'bad alias' })
    class InvalidAliasCommand {}

    return InvalidAliasCommand
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.INVALID_TOKEN }))
})

test('should require a command name', () => {
  expect(() => {
    @Command({ name: '' })
    class MissingNameCommand {}

    return MissingNameCommand
  }).toThrow(expect.objectContaining({ code: F_SYSTEM.MISSING_REQUIRED_PARAM }))
})

test('should reject duplicate command tokens', () => {
  @Command({ name: 'build' })
  class FirstBuildCommand {
    @Handler()
    run() {}
  }

  @Command({ name: 'build' })
  class SecondBuildCommand {
    @Handler()
    run() {}
  }

  expect(() => new Container([FirstBuildCommand, SecondBuildCommand])).toThrow(
    expect.objectContaining({ code: F_SYSTEM.DUPLICATE_COMMAND_TOKEN }),
  )
})
