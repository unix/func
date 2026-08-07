import assert from 'node:assert/strict'
import { join } from 'node:path'
import {
  assertBuiltBehavior,
  assertRegistryPackage,
  parseLatestVersion,
} from './contracts.mjs'
import { npmCommand, readJson, runCommand } from './command.mjs'
import { printDownloadedPackages } from './reporter.mjs'

export const buildNcc = (projectRoot, funcgoBin) => {
  const build = runCommand(
    'funcgo ncc build',
    process.execPath,
    [funcgoBin, 'build-ncc', '-o', 'dist-ncc', '-e', 'func'],
    projectRoot,
  )
  assert.match(build.stdout, /Bundled in/)
  assertBuiltBehavior(projectRoot, 'dist-ncc', 'func-ecosystem')
}

export const buildRolldown = (projectRoot, funcgoBin) => {
  const build = runCommand(
    'funcgo Rolldown build',
    process.execPath,
    [funcgoBin, 'build'],
    projectRoot,
  )
  assert.match(build.stdout, /Bundled in/)
  assertBuiltBehavior(projectRoot, 'dist', 'func-ecosystem')
}

export const installPublishedPackages = (projectRoot, latestVersions) => {
  latestVersions.func = parseLatestVersion(
    runCommand(
      'Resolve func@latest',
      npmCommand,
      ['view', 'func@latest', 'version', '--json'],
      projectRoot,
    ),
  )
  latestVersions.funcgo = parseLatestVersion(
    runCommand(
      'Resolve funcgo@latest',
      npmCommand,
      ['view', 'funcgo@latest', 'version', '--json'],
      projectRoot,
    ),
  )
  runCommand(
    'Install published packages',
    npmCommand,
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
  printDownloadedPackages(lockfile)
  assertRegistryPackage(projectRoot, lockfile, 'func', latestVersions.func)
  assertRegistryPackage(projectRoot, lockfile, 'funcgo', latestVersions.funcgo)
  const manifest = readJson(join(projectRoot, 'package.json'))
  assert.equal(manifest.dependencies.func, latestVersions.func)
  assert.equal(manifest.dependencies.funcgo, latestVersions.funcgo)
}

export const verifyFuncgoWorkflows = (projectRoot, funcgoBin, latestVersions) => {
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
}
