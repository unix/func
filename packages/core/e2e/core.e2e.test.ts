import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

const commandTimeout = 120_000
const projectTimeout = 10_000
const maxBuffer = 10 * 1024 * 1024
const e2eRoot = dirname(fileURLToPath(import.meta.url))
const coreRoot = dirname(e2eRoot)
const sharedSourceRoot = join(e2eRoot, 'shared', 'src')
const temporaryRoot = mkdtempSync(join(tmpdir(), 'func-core-e2e-'))

interface ProjectResult {
  stderr: string
  stdout: string
}

interface CommandFailure extends Error {
  stderr?: string
  stdout?: string
}

interface ConsumerProject {
  directory: 'esm'
  distRoot: string
  expectedEntry: 'index.mjs'
  fixtureRoot: string
  label: string
  root: string
}

interface ExportProbe {
  callableApis: string[]
  runtimeApis: string[]
}

interface PackageManifest {
  exports?: {
    '.'?: {
      import?: string
      require?: string
      types?: string
    }
    './testing'?: {
      import?: string
      require?: string
      types?: string
    }
    './completion'?: {
      import?: string
      require?: string
      types?: string
    }
    './config'?: {
      import?: string
      require?: string
      types?: string
    }
    './log'?: {
      import?: string
      require?: string
      types?: string
    }
    './help'?: {
      import?: string
      require?: string
      types?: string
    }
  }
  main?: string
  module?: string
  name?: string
  type?: string
  types?: string
}

const projectCases = [
  {
    directory: 'esm',
    expectedEntry: 'index.mjs',
    label: 'ES module',
  },
] as const

const projects: ConsumerProject[] = projectCases.map(project => {
  const root = join(temporaryRoot, project.directory)

  return {
    ...project,
    distRoot: join(root, 'dist'),
    fixtureRoot: join(e2eRoot, project.directory),
    root,
  }
})

const runtimeApis = [
  'Args',
  'ArrayNumber',
  'ArrayString',
  'Command',
  'CommandMajor',
  'CommandMissing',
  'Container',
  'Context',
  'Deprecated',
  'DependsOn',
  'Enum',
  'Exclusive',
  'Flag',
  'Exception',
  'ErrorScope',
  'ExceptionContext',
  'Module',
  'Handler',
  'Inject',
  'Injectable',
  'Required',
  'Value',
  'ValueValidate',
  'createApp',
  'createToken',
  'formatExceptionCode',
  'isException',
  'run',
]

const callableApis = [
  'Args',
  'ArrayNumber',
  'ArrayString',
  'Command',
  'CommandMajor',
  'CommandMissing',
  'Container',
  'Deprecated',
  'DependsOn',
  'Enum',
  'Exclusive',
  'Flag',
  'Module',
  'Handler',
  'Inject',
  'Injectable',
  'Required',
  'Value',
  'ValueValidate',
  'createApp',
  'createToken',
  'run',
]

const commandText = (command: string, args: string[]) => {
  return [command, ...args].join(' ')
}

const runCommand = (stage: string, command: string, args: string[], cwd: string) => {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true' },
      maxBuffer,
      stdio: 'pipe',
      timeout: commandTimeout,
    })
  } catch (error) {
    const failure = error as CommandFailure
    const details = [
      `${stage} failed`,
      `command: ${commandText(command, args)}`,
      `cwd: ${cwd}`,
      failure.stderr && `stderr:\n${failure.stderr.trim()}`,
      failure.stdout && `stdout:\n${failure.stdout.trim()}`,
    ].filter(Boolean)

    throw new Error(details.join('\n'), { cause: error })
  }
}

const runProject = (
  project: ConsumerProject,
  args: string[] = [],
  entry = 'index.js',
): ProjectResult => {
  const entryPath = join(project.distRoot, entry)
  const result = spawnSync(process.execPath, [entryPath, ...args], {
    cwd: project.root,
    encoding: 'utf8',
    maxBuffer,
    timeout: projectTimeout,
  })

  const command = commandText('node', [entryPath, ...args])
  if (result.error) {
    throw new Error(`Project command failed to start: ${command}`, {
      cause: result.error,
    })
  }
  if (result.status !== 0) {
    throw new Error(
      [
        `Project command exited with status ${result.status}: ${command}`,
        result.stderr && `stderr:\n${result.stderr.trim()}`,
        result.stdout && `stdout:\n${result.stdout.trim()}`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }

  return {
    stderr: result.stderr,
    stdout: result.stdout,
  }
}

beforeAll(() => {
  runCommand(
    'Packing the core package',
    'pnpm',
    ['pack', '--pack-destination', temporaryRoot],
    coreRoot,
  )

  const tarball = readdirSync(temporaryRoot).find(file => file.endsWith('.tgz'))
  if (!tarball) {
    throw new Error('Core package tarball was not created')
  }

  const tarballPath = join(temporaryRoot, 'func.tgz')
  renameSync(join(temporaryRoot, tarball), tarballPath)

  projects.forEach(project => {
    cpSync(project.fixtureRoot, project.root, { recursive: true })
    cpSync(sharedSourceRoot, join(project.root, 'src'), { recursive: true })
    cpSync(tarballPath, join(project.root, 'func.tgz'))
    runCommand(
      `Installing the packed package for ${project.label}`,
      'pnpm',
      ['--dir', project.root, 'install', '--offline', '--ignore-scripts'],
      coreRoot,
    )
    runCommand(
      `Compiling the ${project.label} consumer project`,
      'pnpm',
      ['--dir', project.root, 'exec', 'tsc', '-p', 'tsconfig.json'],
      coreRoot,
    )
  })
})

afterAll(() => {
  rmSync(temporaryRoot, { force: true, recursive: true })
})

describe.each(projects)('$label consumer', project => {
  test('exposes the complete public runtime API', () => {
    const probe = runProject(project, [], 'exports-probe.js')
    const result = JSON.parse(probe.stdout) as ExportProbe
    expect(result.runtimeApis).toEqual(runtimeApis)
    expect(result.callableApis).toEqual(callableApis)
  })

  test('resolves the correct package output', () => {
    const probe = runProject(project, [], 'api-probe.js')
    const lines = probe.stdout.trim().split('\n')
    const resolvedEntry = lines[0].replaceAll('\\', '/')

    expect(resolvedEntry).toContain(
      `/node_modules/func/dist/${project.expectedEntry}`,
    )
    expect(lines[1]).toBe('Hello, probe!')
  })

  test('keeps testing helpers in the testing subpath', () => {
    const probe = runProject(project, [], 'testing-probe.js')
    expect(probe.stdout.trim()).toBe('testing-entry')
  })

  test('keeps logging helpers in the log subpath', () => {
    const probe = runProject(project, [], 'log-probe.js')
    expect(probe.stdout.trim()).toBe('log-entry')
  })

  test('keeps config helpers in the config subpath', () => {
    const probe = runProject(project, [], 'config-probe.js')
    expect(probe.stdout.trim()).toBe('config-entry')
  })

  test('keeps help helpers in the help subpath', () => {
    const probe = runProject(project, [], 'help-probe.js')
    expect(probe.stdout.trim()).toBe('help-entry')
  })

  test('keeps completion helpers in the completion subpath', () => {
    const probe = runProject(project, [], 'completion-probe.js')
    expect(probe.stdout.trim()).toBe('completion-entry')
  })

  test('ships self-contained declarations for every public entry', () => {
    const typesRoot = join(project.root, 'node_modules', 'func', 'dist', 'types')
    const declarations = readdirSync(typesRoot, {
      encoding: 'utf8',
      recursive: true,
    })
      .filter(file => file.endsWith('.d.ts'))
      .sort()
    const declarationPaths = declarations.map(file => file.replaceAll('\\', '/'))

    expect(declarationPaths).toEqual(
      expect.arrayContaining([
        'index.d.ts',
        'subpath/completion/index.d.ts',
        'subpath/config/index.d.ts',
        'subpath/help/index.d.ts',
        'subpath/log/index.d.ts',
        'subpath/testing/index.d.ts',
      ]),
    )
    expect(declarationPaths).not.toContain('di/index.d.ts')
    declarations.forEach(file => {
      expect(readFileSync(join(typesRoot, file), 'utf8')).not.toContain(
        '@func/shared',
      )
    })
  })

  test('publishes the expected ESM-only metadata', () => {
    const manifestPath = join(project.root, 'node_modules', 'func', 'package.json')
    const manifest = JSON.parse(
      readFileSync(manifestPath, 'utf8'),
    ) as PackageManifest

    expect(manifest).toMatchObject({
      exports: {
        '.': {
          import: './dist/index.mjs',
          types: './dist/types/index.d.ts',
        },
        './testing': {
          import: './dist/testing.mjs',
          types: './dist/types/subpath/testing/index.d.ts',
        },
        './completion': {
          import: './dist/completion.mjs',
          types: './dist/types/subpath/completion/index.d.ts',
        },
        './config': {
          import: './dist/config.mjs',
          types: './dist/types/subpath/config/index.d.ts',
        },
        './log': {
          import: './dist/log.mjs',
          types: './dist/types/subpath/log/index.d.ts',
        },
        './help': {
          import: './dist/help.mjs',
          types: './dist/types/subpath/help/index.d.ts',
        },
      },
      name: 'func',
      module: './dist/index.mjs',
      type: 'commonjs',
      types: './dist/types/index.d.ts',
    })

    expect(manifest.exports).not.toHaveProperty('./di')
    expect(manifest.main).toBeUndefined()
    Object.values(manifest.exports ?? {}).forEach(entry => {
      expect(entry.require).toBeUndefined()
    })
  })

  test('runs modules, services, injections, handlers, and field options', () => {
    const major = runProject(project, [
      '--mode',
      'prod',
      '--tag',
      'api',
      '--dry-run',
    ])
    const greet = runProject(project, [
      'greet',
      'shout',
      '--name',
      'func',
      '--upper',
    ])
    const deploy = runProject(project, [
      'deploy',
      '--target',
      'production',
      '--registry',
      'npm',
      '--token',
      'secret',
      '--table',
    ])
    const help = runProject(project, ['--help'])

    expect(JSON.parse(major.stdout)).toEqual({
      dryRun: true,
      kind: 'major',
      mode: 'prod',
      project: 'func-core-e2e',
      tags: ['api'],
    })
    expect(greet.stdout.trim()).toBe('HELLO, FUNC!')
    expect(JSON.parse(deploy.stdout)).toEqual({
      json: false,
      registry: 'npm',
      table: true,
      target: 'production',
    })
    expect(help.stdout.trim()).toBe('commands:async,deploy,greet,greet shout')
  })

  test('supports aliases, repeated array values, and asynchronous handlers', () => {
    const greet = runProject(project, ['g', '-n', 'func', '-u'])
    const major = runProject(project, [
      '--mode',
      'prod',
      '--tag',
      'api',
      '--tag',
      'cli',
      '-d',
    ])
    const help = runProject(project, ['-h'])
    const asyncHandler = runProject(project, ['async'])
    expect(greet.stdout.trim()).toBe('HELLO, FUNC!')
    expect(JSON.parse(major.stdout)).toEqual({
      dryRun: true,
      kind: 'major',
      mode: 'prod',
      project: 'func-core-e2e',
      tags: ['api', 'cli'],
    })
    expect(help.stdout.trim()).toBe('commands:async,deploy,greet,greet shout')
    expect(asyncHandler.stdout.trim()).toBe('async:func-core-e2e')
  })

  test('runs missing, local catch, and global error handlers', () => {
    const missing = runProject(project, ['unknown'])
    const required = runProject(project, ['deploy'])
    const dependsOn = runProject(project, [
      'deploy',
      '--target',
      'prod',
      '--registry',
      'npm',
    ])
    const exclusive = runProject(project, [
      'deploy',
      '--target',
      'prod',
      '--table',
      '--json',
    ])
    const global = runProject(project, ['--unknown'])
    expect(missing.stderr.trim()).toBe('missing:unknown')
    expect(required.stderr).toContain('local:F_RUNTIME_PRINT_VALIDATION')
    expect(required.stderr).toContain('Option "--target" is required.')
    expect(dependsOn.stderr).toContain('Option "--registry" depends on: --token.')
    expect(exclusive.stderr).toContain(
      'Option "--table" cannot be used with: --json.',
    )
    expect(global.stderr).toContain('global:F_RUNTIME_PRINT_UNKNOWN_OPTION')
  })
})
