import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertBuiltBehavior } from './contracts.mjs'
import { environment } from './command.mjs'

export const testWatchBuild = async (projectRoot, funcgoBin) => {
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
