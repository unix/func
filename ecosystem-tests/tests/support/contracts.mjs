import assert from 'node:assert/strict'
import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { readJson, runCommand } from './command.mjs'

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

export const assertBuiltBehavior = (projectRoot, output, projectName) => {
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

export const assertRegistryPackage = (projectRoot, lockfile, name, version) => {
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

export const parseLatestVersion = result => {
  const value = JSON.parse(result.stdout)
  if (!Array.isArray(value)) return value

  assert.equal(value.length, 1)
  return value[0]
}

export const verifyPublicApis = projectRoot => {
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
    'TypeScript verification',
    tsc,
    ['--project', 'tsconfig.verify.json'],
    projectRoot,
  )
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

const parseProbe = result => {
  return JSON.parse(result.stdout.trim())
}
