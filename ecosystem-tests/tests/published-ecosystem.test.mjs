import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const commandTimeout = 180_000
const testTimeout = 600_000
const maxBuffer = 20 * 1024 * 1024
const testsRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const fixtureRoot = join(testsRoot, 'fixtures', 'full-project')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const environment = {
  ...process.env,
  CI: 'true',
  NO_COLOR: '1',
  npm_config_audit: 'false',
  npm_config_fund: 'false',
}

const expectedFuncApi = {
  Args: 'function',
  ArrayValue: 'function',
  Catch: 'function',
  CatchAll: 'function',
  Command: 'function',
  CommandError: 'function',
  CommandMajor: 'function',
  CommandMissing: 'function',
  CommandRegistry: 'function',
  Container: 'function',
  DependsOn: 'function',
  Enum: 'function',
  Exception: 'function',
  Exclusive: 'function',
  F_EFFECT: 'object',
  F_RUNTIME: 'object',
  F_RUNTIME_PRINT: 'object',
  F_SYSTEM: 'object',
  Flag: 'function',
  FuncError: 'function',
  FuncException: 'function',
  FuncModule: 'function',
  Handler: 'function',
  Regs: 'function',
  Required: 'function',
  Service: 'function',
  SubOptions: 'function',
  Value: 'function',
  ValueValidate: 'function',
  createApp: 'function',
  createRuntimeError: 'function',
  createRuntimePrintError: 'function',
  createSystemError: 'function',
  errorLevels: 'object',
  errorScopes: 'object',
  errorTokenTypes: 'object',
  errorTypes: 'object',
  handleEffect: 'function',
  handleRuntimePrintError: 'function',
  handleSystemError: 'function',
  isFuncError: 'function',
  normalizeRuntimeError: 'function',
  run: 'function',
}

const expectedFuncgoApi = {
  main: 'function',
}

const commandText = (command, args) => {
  return [command, ...args].join(' ')
}

const runCommand = (stage, command, args, cwd, timeout = commandTimeout) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: environment,
    maxBuffer,
    timeout,
  })

  if (result.error) {
    throw new Error(`${stage} failed to start: ${commandText(command, args)}`, {
      cause: result.error,
    })
  }

  if (result.status !== 0) {
    const details = [
      `${stage} exited with status ${result.status}`,
      `command: ${commandText(command, args)}`,
      `cwd: ${cwd}`,
      result.stderr && `stderr:\n${result.stderr.trim()}`,
      result.stdout && `stdout:\n${result.stdout.trim()}`,
    ].filter(Boolean)

    throw new Error(details.join('\n'))
  }

  return {
    stderr: result.stderr,
    stdout: result.stdout,
  }
}

const readJson = path => {
  return JSON.parse(readFileSync(path, 'utf8'))
}

const assertRegistryPackage = (projectRoot, lockfile, name, version) => {
  const moduleRoot = join(projectRoot, 'node_modules', name)
  const installedManifest = readJson(join(moduleRoot, 'package.json'))
  const lockEntry = lockfile.packages[`node_modules/${name}`]
  const resolvedProjectRoot = realpathSync(projectRoot)
  const resolvedRoot = realpathSync(moduleRoot)
  const resolvedRelative = relative(resolvedProjectRoot, resolvedRoot)

  assert.equal(installedManifest.version, version)
  assert.equal(lstatSync(moduleRoot).isSymbolicLink(), false)
  assert.equal(lockEntry.link, undefined)
  assert.match(lockEntry.resolved, /^https?:\/\//)
  assert.equal(isAbsolute(resolvedRelative), false)
  assert.equal(resolvedRelative.startsWith('..'), false)
}

const parseProbe = result => {
  return JSON.parse(result.stdout.trim())
}

const parseLatestVersion = result => {
  const value = JSON.parse(result.stdout)
  if (!Array.isArray(value)) return value

  assert.equal(value.length, 1)
  return value[0]
}

const builtCommand = (projectRoot, output, args) => {
  const bin = join(projectRoot, output, 'bin.js')
  if (process.platform === 'win32') {
    return runCommand(
      `${output} command`,
      process.execPath,
      [bin, ...args],
      projectRoot,
    )
  }

  return runCommand(`${output} command`, bin, args, projectRoot)
}

const assertBuiltBehavior = (projectRoot, output, projectName) => {
  const outputRoot = join(projectRoot, output)
  const entry = join(outputRoot, 'index.js')
  const bin = join(outputRoot, 'bin.js')
  assert.equal(existsSync(entry), true)
  assert.equal(existsSync(bin), true)
  assert.ok(statSync(entry).size > 0)
  assert.ok((statSync(bin).mode & 0o111) > 0)
  assert.equal(
    readFileSync(bin, 'utf8'),
    "#!/usr/bin/env node\nrequire('./index.js')\n",
  )

  const major = builtCommand(projectRoot, output, [
    '--mode',
    'prod',
    '--tag',
    'api',
    '--tag',
    'cli',
    '--dry-run',
  ])
  const greet = builtCommand(projectRoot, output, ['g', '-n', 'func', '-u'])
  const shout = builtCommand(projectRoot, output, [
    'greet',
    'shout',
    '--name',
    'func',
  ])
  const asyncCommand = builtCommand(projectRoot, output, ['async'])
  const deploy = builtCommand(projectRoot, output, [
    'deploy',
    '--target',
    'production',
    '--registry',
    'npm',
    '--token',
    'secret',
    '--table',
  ])
  const help = builtCommand(projectRoot, output, ['--help'])
  const missing = builtCommand(projectRoot, output, ['unknown'])
  const required = builtCommand(projectRoot, output, ['deploy'])
  const validation = builtCommand(projectRoot, output, ['deploy', '--target', 'no'])
  const dependsOn = builtCommand(projectRoot, output, [
    'deploy',
    '--target',
    'production',
    '--registry',
    'npm',
  ])
  const exclusive = builtCommand(projectRoot, output, [
    'deploy',
    '--target',
    'production',
    '--table',
    '--json',
  ])
  const enumFailure = builtCommand(projectRoot, output, ['--mode', 'staging'])
  const global = builtCommand(projectRoot, output, ['--unknown'])

  assert.deepEqual(JSON.parse(major.stdout), {
    dryRun: true,
    kind: 'major',
    mode: 'prod',
    project: projectName,
    tags: ['api', 'cli'],
  })
  assert.equal(greet.stdout.trim(), 'HELLO, FUNC!')
  assert.equal(shout.stdout.trim(), 'HELLO, FUNC!')
  assert.equal(asyncCommand.stdout.trim(), `async:${projectName}`)
  assert.deepEqual(JSON.parse(deploy.stdout), {
    json: false,
    registry: 'npm',
    table: true,
    target: 'production',
  })
  assert.equal(help.stdout.trim(), 'commands:async,deploy,greet')
  assert.equal(missing.stderr.trim(), 'missing:unknown')
  assert.match(required.stderr, /local:F_RUNTIME_PRINT_VALIDATION/)
  assert.match(required.stderr, /Option "--target" is required\./)
  assert.match(validation.stderr, /Option "--target" is invalid\./)
  assert.match(dependsOn.stderr, /Option "--registry" depends on: --token\./)
  assert.match(exclusive.stderr, /Option "--table" cannot be used with: --json\./)
  assert.match(enumFailure.stderr, /global:F_RUNTIME_PRINT_VALIDATION/)
  assert.match(enumFailure.stderr, /Option "--mode" must be one of: dev, prod\./)
  assert.match(global.stderr, /global:F_RUNTIME_PRINT_UNKNOWN_OPTION/)
}

const waitFor = async (description, predicate, child, output) => {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (predicate()) return
    if (child.exitCode !== null) {
      throw new Error(
        `${description}: watcher exited early with status ${child.exitCode}\n${output()}`,
      )
    }

    await new Promise(resolve => setTimeout(resolve, 50))
  }

  throw new Error(`${description}: timed out\n${output()}`)
}

const countMatches = (value, pattern) => {
  return value.match(pattern)?.length || 0
}

const stopChild = async child => {
  if (child.exitCode !== null) return

  const exited = new Promise(resolve => child.once('exit', resolve))
  child.kill('SIGTERM')
  const completed = await Promise.race([
    exited.then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), 5_000)),
  ])
  if (completed) return

  child.kill('SIGKILL')
  await exited
}

const testWatchBuild = async (projectRoot, funcgoBin) => {
  const configPath = join(projectRoot, 'src', 'config.ts')
  const originalConfig = readFileSync(configPath, 'utf8')
  const child = spawn(
    process.execPath,
    [
      funcgoBin,
      'build',
      '-f',
      'src/index.ts',
      '-o',
      'dist-watch',
      '-e',
      'func',
      '--watch',
      '--watch-path',
      'src',
    ],
    {
      cwd: projectRoot,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let stderr = ''
  let stdout = ''
  child.stderr.setEncoding('utf8')
  child.stdout.setEncoding('utf8')
  child.stderr.on('data', chunk => {
    stderr += chunk
  })
  child.stdout.on('data', chunk => {
    stdout += chunk
  })
  const output = () => `stdout:\n${stdout}\nstderr:\n${stderr}`

  try {
    await waitFor(
      'initial watch build',
      () => stdout.includes('Watching for changes...'),
      child,
      output,
    )
    assertBuiltBehavior(projectRoot, 'dist-watch', 'func-ecosystem')

    writeFileSync(
      configPath,
      "export const projectName = 'func-ecosystem-updated'\n",
    )
    await waitFor(
      'watch rebuild',
      () => countMatches(stdout, /Bundled in/g) >= 2,
      child,
      output,
    )
    assertBuiltBehavior(projectRoot, 'dist-watch', 'func-ecosystem-updated')
  } finally {
    writeFileSync(configPath, originalConfig)
    await stopChild(child)
  }
}

test(
  'published npm packages satisfy the complete ecosystem contract',
  { timeout: testTimeout },
  async t => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'func-ecosystem-'))
    const projectRoot = join(temporaryRoot, 'project')
    cpSync(fixtureRoot, projectRoot, { recursive: true })
    t.after(() => {
      rmSync(temporaryRoot, { force: true, recursive: true })
    })

    const latestVersions = {
      func: parseLatestVersion(
        runCommand(
          'Resolve func@latest',
          npm,
          ['view', 'func@latest', 'version', '--json'],
          projectRoot,
        ),
      ),
      funcgo: parseLatestVersion(
        runCommand(
          'Resolve funcgo@latest',
          npm,
          ['view', 'funcgo@latest', 'version', '--json'],
          projectRoot,
        ),
      ),
    }

    await t.test('installs the latest packages from npm without links', () => {
      runCommand(
        'Install published packages',
        npm,
        [
          'install',
          '--save-exact',
          '--no-audit',
          '--no-fund',
          'func@latest',
          'funcgo@latest',
        ],
        projectRoot,
      )

      const lockfile = readJson(join(projectRoot, 'package-lock.json'))
      assertRegistryPackage(projectRoot, lockfile, 'func', latestVersions.func)
      assertRegistryPackage(projectRoot, lockfile, 'funcgo', latestVersions.funcgo)
      const manifest = readJson(join(projectRoot, 'package.json'))
      assert.equal(manifest.dependencies.func, latestVersions.func)
      assert.equal(manifest.dependencies.funcgo, latestVersions.funcgo)
    })

    const funcgoBin = join(projectRoot, 'node_modules', 'funcgo', 'dist', 'bin.js')

    await t.test('exposes every CommonJS, ES module, and TypeScript API', () => {
      const commonjs = parseProbe(
        runCommand(
          'CommonJS API probe',
          process.execPath,
          [join(projectRoot, 'probes', 'runtime.cjs')],
          projectRoot,
        ),
      )
      const esm = parseProbe(
        runCommand(
          'ES module API probe',
          process.execPath,
          [join(projectRoot, 'probes', 'runtime.mjs')],
          projectRoot,
        ),
      )
      assert.deepEqual(commonjs.func, expectedFuncApi)
      assert.deepEqual(commonjs.funcgo, expectedFuncgoApi)
      assert.deepEqual(esm, commonjs)

      const behavior = parseProbe(
        runCommand(
          'Runtime API behavior probe',
          process.execPath,
          [join(projectRoot, 'probes', 'api-behavior.cjs')],
          projectRoot,
        ),
      )
      assert.deepEqual(behavior, {
        commandScope: 'command',
        legacyDecorator: 'function',
        optionToken: 'option name',
        status: 'ok',
      })

      const tsc = join(
        projectRoot,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
      )
      runCommand(
        'TypeScript API probe',
        tsc,
        ['--project', 'tsconfig.api.json'],
        projectRoot,
      )
    })

    await t.test(
      'runs funcgo help, version, setup, and development workflows',
      () => {
        const help = runCommand(
          'funcgo help',
          process.execPath,
          [funcgoBin, '--help'],
          projectRoot,
        )
        assert.match(help.stdout, /FUNCGO/)
        assert.match(help.stdout, /build-ncc/)
        assert.match(help.stdout, /setup/)

        const version = runCommand(
          'funcgo version',
          process.execPath,
          [funcgoBin, '--version'],
          projectRoot,
        )
        assert.equal(version.stdout.trim(), latestVersions.funcgo)

        const suggestions = runCommand(
          'funcgo setup suggestions',
          process.execPath,
          [funcgoBin, 'setup'],
          projectRoot,
        )
        assert.match(suggestions.stdout, /package\.json#func\.entry/)
        assert.match(suggestions.stdout, /package\.json#bin\.func-ecosystem-fixture/)
        assert.match(suggestions.stdout, /package\.json#scripts\.build/)

        runCommand(
          'funcgo setup fix',
          process.execPath,
          [funcgoBin, 'setup', '--fix'],
          projectRoot,
        )
        const manifest = readJson(join(projectRoot, 'package.json'))
        assert.deepEqual(manifest.func, {
          entry: 'src/index.ts',
          outDir: 'dist',
        })
        assert.deepEqual(manifest.bin, {
          'func-ecosystem-fixture': './dist/bin.js',
        })
        assert.equal(manifest.scripts.dev, 'funcgo dev --')
        assert.equal(manifest.scripts.build, 'funcgo build')

        const cleanSetup = runCommand(
          'funcgo clean setup check',
          process.execPath,
          [funcgoBin, 'setup'],
          projectRoot,
        )
        assert.equal(cleanSetup.stdout.trim(), 'No changes needed.')

        const development = runCommand(
          'funcgo development runtime',
          process.execPath,
          [funcgoBin, 'dev', '-f', 'src/index.ts', '--', 'g', '-n', 'func', '-u'],
          projectRoot,
        )
        assert.equal(development.stdout.trim(), 'HELLO, FUNC!')
      },
    )

    await t.test('builds and validates the Rolldown artifact', () => {
      const build = runCommand(
        'funcgo Rolldown build',
        process.execPath,
        [funcgoBin, 'build'],
        projectRoot,
      )
      assert.match(build.stdout, /Bundled in/)
      assertBuiltBehavior(projectRoot, 'dist', 'func-ecosystem')
    })

    await t.test('builds and validates the ncc artifact', () => {
      const build = runCommand(
        'funcgo ncc build',
        process.execPath,
        [funcgoBin, 'build-ncc', '-o', 'dist-ncc', '-e', 'func'],
        projectRoot,
      )
      assert.match(build.stdout, /Bundled in/)
      assertBuiltBehavior(projectRoot, 'dist-ncc', 'func-ecosystem')
    })

    await t.test(
      'watches, rebuilds, and validates the updated artifact',
      async () => {
        await testWatchBuild(projectRoot, funcgoBin)
      },
    )
  },
)
