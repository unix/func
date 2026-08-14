import { Command, Deprecated, Flag, Handler, Module, OptionCommand } from '../src'
import { HelpOption } from '../src/subpath/help'
import type { HelpMeta } from '../src/subpath/help'
import { createTestingApp } from '../src/subpath/testing'
import { expect, test } from './_test'

test.sequential(
  'should warn once for selected deprecated commands and options',
  async () => {
    @OptionCommand({
      alias: 'g',
      deprecated: 'Use --global instead.',
      name: 'legacy-global',
    })
    class LegacyGlobalOption {
      @Handler()
      run() {
        return 'global'
      }
    }

    @Command({
      alias: 'l',
      deprecated: 'Use modern instead.',
      path: 'legacy',
    })
    class LegacyCommand {
      @Deprecated('Use --modern instead.')
      @Flag({ alias: 'o', name: 'old', negatable: true })
      old = true

      @Handler()
      run() {
        return this.old
      }

      @Deprecated('Use --modern-action instead.')
      @Handler({ alias: 'a', flag: 'legacy-action' })
      legacyAction() {
        return 'action'
      }
    }

    @Module({
      commands: [LegacyCommand],
      options: [LegacyGlobalOption],
    })
    class AppModule {}

    const app = createTestingApp(AppModule)
    const field = await app.invoke(['l', '--no-old', '--no-old'])
    expect(field).toMatchObject({ error: undefined, exitCode: 0, result: false })
    expect(field.stderr).toBe(
      'Command "legacy" is deprecated. Use modern instead.\n' +
        'Option "--old" is deprecated. Use --modern instead.\n',
    )
    const fieldAlias = await app.invoke(['legacy', '-o'])
    expect(fieldAlias.stderr).toBe(
      'Command "legacy" is deprecated. Use modern instead.\n' +
        'Option "--old" is deprecated. Use --modern instead.\n',
    )

    const action = await app.invoke(['legacy', '-a'])
    expect(action.result).toBe('action')
    expect(action.stderr).toBe(
      'Command "legacy" is deprecated. Use modern instead.\n' +
        'Option "--legacy-action" is deprecated. Use --modern-action instead.\n',
    )

    const optionCommand = await app.invoke(['-g'])
    expect(optionCommand.result).toBe('global')
    expect(optionCommand.stderr).toBe(
      'Option "--legacy-global" is deprecated. Use --global instead.\n',
    )

    const omitted = await app.invoke(['legacy'])
    expect(omitted.result).toBe(true)
    expect(omitted.stderr).toBe(
      'Command "legacy" is deprecated. Use modern instead.\n',
    )
  },
)

test.sequential('should expose deprecations through structured help', async () => {
  let captured: HelpMeta | undefined

  class AppHelp extends HelpOption {
    override transform(meta: HelpMeta): HelpMeta {
      captured = meta
      return meta
    }
  }

  @OptionCommand({ deprecated: true, name: 'legacy-global' })
  class LegacyGlobalOption {
    @Handler()
    run() {}
  }

  @Command({ deprecated: 'Use modern instead.', path: 'legacy' })
  class LegacyCommand {
    @Deprecated('Use --modern instead.')
    @Flag({ name: 'old' })
    old = false

    @Handler()
    run() {}

    @Deprecated()
    @Handler({ flag: 'legacy-action' })
    legacyAction() {}
  }

  @Module({
    commands: [LegacyCommand],
    options: [AppHelp, LegacyGlobalOption],
  })
  class AppModule {}

  const app = createTestingApp(AppModule)
  const root = await app.invoke(['--help'])
  expect(root.error).toBeUndefined()
  expect(captured).toMatchObject({
    commands: [
      expect.objectContaining({
        deprecated: 'Use modern instead.',
        name: 'legacy',
      }),
    ],
    options: expect.arrayContaining([
      expect.objectContaining({ deprecated: true, name: 'legacy-global' }),
    ]),
  })
  expect(root.stdout).toContain('deprecated: Use modern instead.')
  expect(root.stdout).toContain('--legacy-global')
  expect(root.stdout).toContain('deprecated')
  const command = await app.invoke(['legacy', '--help'])
  expect(command.error).toBeUndefined()
  expect(command.stderr).toBe('')
  expect(captured).toMatchObject({
    deprecated: 'Use modern instead.',
    options: expect.arrayContaining([
      expect.objectContaining({
        deprecated: 'Use --modern instead.',
        name: 'old',
      }),
      expect.objectContaining({ deprecated: true, name: 'legacy-action' }),
    ]),
  })
  expect(command.stdout).toContain('Deprecated: Use modern instead.')
  expect(command.stdout).toContain('deprecated: Use --modern instead.')
})

test.sequential(
  'should use the deprecation state of the effective overridden action',
  async () => {
    @OptionCommand({ deprecated: true, name: 'inspect' })
    class RootInspectOption {
      @Handler()
      run() {
        return 'root'
      }
    }

    @OptionCommand({ name: 'inspect', overrideAll: true })
    class FeatureInspectOption {
      @Handler()
      run() {
        return 'feature'
      }
    }

    @Command('root')
    class RootCommand {
      @Handler()
      run() {}
    }

    @Command('feature')
    class FeatureCommand {
      @Handler()
      run() {}
    }

    @Module({
      commands: [FeatureCommand],
      options: [FeatureInspectOption],
    })
    class FeatureModule {}

    @Module({
      commands: [RootCommand],
      imports: [FeatureModule],
      options: [RootInspectOption],
    })
    class AppModule {}

    const app = createTestingApp(AppModule)
    const root = await app.invoke(['root', '--inspect'])
    expect(root.result).toBe('root')
    expect(root.stderr).toBe('Option "--inspect" is deprecated.\n')
    const feature = await app.invoke(['feature', '--inspect'])
    expect(feature.result).toBe('feature')
    expect(feature.stderr).toBe('')
  },
)
