import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expectTypeOf } from 'vitest'
import { CommandMajor, Module, Handler } from '../src'
import { Config, ConfigFile, ConfigModule } from '../src/subpath/config'
import type { ConfigDefaults } from '../src/subpath/config'
import { bindConfig } from '../src/subpath/config/runtime'
import {
  CONFIG_RUNTIME,
  CONFIG_SYSTEM,
  configRuntimeErrorCode,
  configSystemErrorCode,
  expect,
  objectContaining,
  run,
  test,
} from './_test'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach(directory => {
    rmSync(directory, { force: true, recursive: true })
  })
})

test('should infer config keys and values from defaults', () => {
  class ProfileConfig extends Config({
    name: '',
    retries: 3,
  }) {}

  const profile = new ProfileConfig()
  bindConfig(profile, {
    filePath: temporaryFile('profile.json'),
  })
  expectTypeOf(profile.get('name')).toEqualTypeOf<string>()
  expectTypeOf(profile.get('retries')).toEqualTypeOf<number>()
  expectTypeOf<Parameters<ProfileConfig['get']>[0]>().toEqualTypeOf<
    'name' | 'retries'
  >()
})

test('should reject duplicate default config files during initialization', async () => {
  class ProfileConfig extends Config({ name: '' }) {}
  class ProjectConfig extends Config({ name: '' }) {}

  @CommandMajor()
  class Major {
    constructor(_profile: ProfileConfig, _project: ProjectConfig) {}

    @Handler()
    run() {}
  }

  @Module({
    commands: [Major],
    imports: [ConfigModule.register({ configs: [ProfileConfig, ProjectConfig] })],
  })
  class AppModule {}

  await expect(
    run(AppModule, {
      appName: 'func-config-test',
      argv: [],
    }),
  ).rejects.toMatchObject({
    code: configSystemErrorCode(CONFIG_SYSTEM.DUPLICATE_FILE),
    details: objectContaining({
      appName: 'func-config-test',
      fileName: 'config.json',
      name: 'config',
    }),
  })
})

test('should reject the same initialized file across config modules', async () => {
  class ProfileConfig extends Config({ name: '' }) {}
  class ProjectConfig extends Config({ name: '' }) {}

  const first = ConfigModule.register({
    configs: [ProfileConfig],
  })
  const second = ConfigModule.register({
    configs: [ProjectConfig],
  })

  @CommandMajor()
  class Major {
    constructor(_profile: ProfileConfig, _project: ProjectConfig) {}

    @Handler()
    run() {}
  }

  @Module({ commands: [Major], imports: [first, second] })
  class AppModule {}

  await expect(
    run(AppModule, {
      appName: 'func-config-test',
      argv: [],
    }),
  ).rejects.toMatchObject({
    code: configSystemErrorCode(CONFIG_SYSTEM.DUPLICATE_FILE),
    details: objectContaining({
      appName: 'func-config-test',
      fileName: 'config.json',
      name: 'config',
    }),
  })
})

test('should allow the same config file path in separate applications', async () => {
  class ProfileConfig extends Config({ name: '' }) {}
  class ProjectConfig extends Config({ name: '' }) {}

  const first = ConfigModule.register({
    configs: [ProfileConfig],
  })
  const second = ConfigModule.register({
    configs: [ProjectConfig],
  })

  @CommandMajor()
  class ProfileMajor {
    constructor(_config: ProfileConfig) {}

    @Handler()
    run() {}
  }

  @CommandMajor()
  class ProjectMajor {
    constructor(_config: ProjectConfig) {}

    @Handler()
    run() {}
  }

  @Module({ commands: [ProfileMajor], imports: [first] })
  class ProfileApp {}

  @Module({ commands: [ProjectMajor], imports: [second] })
  class ProjectApp {}

  await expect(
    run(ProfileApp, {
      appName: 'func-config-test',
      argv: [],
    }),
  ).resolves.toMatchObject({ exitCode: 0 })
  await expect(
    run(ProjectApp, {
      appName: 'func-config-test',
      argv: [],
    }),
  ).resolves.toMatchObject({ exitCode: 0 })
})

test('should allow the same app name with different config file names', async () => {
  @ConfigFile({ name: 'profile' })
  class ProfileConfig extends Config({ name: '' }) {}

  @ConfigFile({ name: 'project' })
  class ProjectConfig extends Config({ name: '' }) {}

  const first = ConfigModule.register({
    configs: [ProfileConfig],
  })
  const second = ConfigModule.register({
    configs: [ProjectConfig],
  })

  @CommandMajor()
  class Major {
    constructor(_profile: ProfileConfig, _project: ProjectConfig) {}

    @Handler()
    run() {}
  }

  @Module({ commands: [Major], imports: [first, second] })
  class AppModule {}

  await expect(
    run(AppModule, {
      appName: 'func-config-test',
      argv: [],
    }),
  ).resolves.toMatchObject({ exitCode: 0 })
})

test('should require an application name during initialization', async () => {
  class ProfileConfig extends Config({ name: '' }) {}

  @CommandMajor()
  class Major {
    constructor(_config: ProfileConfig) {}

    @Handler()
    run() {}
  }

  @Module({
    commands: [Major],
    imports: [ConfigModule.register({ configs: [ProfileConfig] })],
  })
  class AppModule {}

  await expect(run(AppModule, { argv: [] })).rejects.toMatchObject({
    code: 'F_SYSTEM_MISSING_APP_NAME',
    message: 'F_SYSTEM_MISSING_APP_NAME',
  })
})

test('should validate the application name during initialization', async () => {
  class ProfileConfig extends Config({ name: '' }) {}

  @CommandMajor()
  class Major {
    constructor(_config: ProfileConfig) {}

    @Handler()
    run() {}
  }

  @Module({
    commands: [Major],
    imports: [ConfigModule.register({ configs: [ProfileConfig] })],
  })
  class AppModule {}

  await expect(
    run(AppModule, { appName: '../unsafe', argv: [] }),
  ).rejects.toMatchObject({
    code: 'F_SYSTEM_INVALID_APP_NAME',
    message: 'F_SYSTEM_INVALID_APP_NAME',
  })
})

test.sequential('should inject configs with and without @ConfigFile', async () => {
  expect.assertions(2)
  class AppConfig extends Config({ debug: false }) {}

  @ConfigFile({ name: 'profile' })
  class ProfileConfig extends Config({ name: '' }) {}

  @CommandMajor()
  class Major {
    constructor(
      private app: AppConfig,
      private profile: ProfileConfig,
    ) {}

    @Handler()
    run() {
      expect(this.app).toBeInstanceOf(AppConfig)
      expect(this.profile).toBeInstanceOf(ProfileConfig)
    }
  }

  @Module({
    imports: [
      ConfigModule.register({
        configs: [AppConfig, ProfileConfig],
      }),
    ],
    commands: [Major],
  })
  class AppModule {}

  await run(AppModule, { appName: 'func-config-test', argv: [] })
})

test('should lazily create, update, and reset a config file', () => {
  class ProfileConfig extends Config({
    name: '',
    nested: {
      enabled: true,
      label: 'default',
    },
  }) {}

  const filePath = temporaryFile('profile.json')
  const profile = new ProfileConfig()
  bindConfig(profile, { filePath })
  expect(existsSync(filePath)).toBe(false)
  expect(profile.get('name')).toBe('')
  expect(existsSync(filePath)).toBe(true)
  profile.set('name', 'func')
  profile.set('nested', { enabled: false, label: 'custom' })
  expect(profile.getAll()).toEqual({
    name: 'func',
    nested: { enabled: false, label: 'custom' },
  })

  profile.reset('name')
  expect(profile.get('name')).toBe('')
  profile.resetAll()
  expect(profile.getAll()).toEqual({
    name: '',
    nested: { enabled: true, label: 'default' },
  })
})

test('should merge missing nested defaults without changing the source file', () => {
  class ProfileConfig extends Config({
    nested: {
      enabled: true,
      label: 'default',
    },
  }) {}

  const filePath = temporaryFile('profile.json')
  writeFileSync(filePath, '{"nested":{"label":"custom"}}\n')
  const profile = new ProfileConfig()
  bindConfig(profile, { filePath })
  expect(profile.get('nested')).toEqual({ enabled: true, label: 'custom' })
  expect(readFileSync(filePath, 'utf8')).toBe('{"nested":{"label":"custom"}}\n')
})

test('should ignore unknown stored keys without changing the source file', () => {
  class ProfileConfig extends Config({
    name: '',
    nested: { enabled: true },
  }) {}

  const content =
    '{"name":"func","removed":"legacy","nested":{"enabled":false,"extra":"legacy"}}\n'
  const filePath = temporaryFile('profile.json')
  writeFileSync(filePath, content)
  const profile = new ProfileConfig()
  bindConfig(profile, { filePath })
  expect(profile.getAll()).toEqual({
    name: 'func',
    nested: { enabled: false },
  })
  expect(readFileSync(filePath, 'utf8')).toBe(content)
})

test('should reject stored values that do not match default shapes', () => {
  const assertMismatch = (
    defaults: ConfigDefaults,
    stored: ConfigDefaults,
    key: string,
    expectedType: string,
    actualType: string,
  ) => {
    const ConfigClass = Config(defaults)
    const content = `${JSON.stringify(stored)}\n`
    const filePath = temporaryFile('profile.json')
    writeFileSync(filePath, content)
    const profile = new ConfigClass()
    bindConfig(profile, { filePath })
    expect(() => profile.getAll()).toThrow(
      expect.objectContaining({
        code: configRuntimeErrorCode(CONFIG_RUNTIME.FILE_SCHEMA),
        details: { actualType, expectedType, key, path: filePath },
      }),
    )
    expect(readFileSync(filePath, 'utf8')).toBe(content)
  }

  assertMismatch({ retries: 3 }, { retries: '3' }, 'retries', 'number', 'string')
  assertMismatch(
    { nested: { enabled: true } },
    { nested: false },
    'nested',
    'object',
    'boolean',
  )
  assertMismatch({ tags: [] }, { tags: 'api' }, 'tags', 'array', 'string')
})

test('should preserve an invalid file until resetAll explicitly replaces it', () => {
  class ProfileConfig extends Config({ name: '' }) {}
  const filePath = temporaryFile('profile.json')
  writeFileSync(filePath, '{ invalid json')
  const profile = new ProfileConfig()
  bindConfig(profile, { filePath })
  expect(() => profile.getAll()).toThrow(
    expect.objectContaining({
      code: configRuntimeErrorCode(CONFIG_RUNTIME.FILE_PARSE),
    }),
  )
  expect(readFileSync(filePath, 'utf8')).toBe('{ invalid json')
  profile.resetAll()
  expect(profile.getAll()).toEqual({ name: '' })
})

const temporaryFile = (name: string): string => {
  const directory = mkdtempSync(join(tmpdir(), 'func-config-'))
  temporaryDirectories.push(directory)
  return join(directory, name)
}
