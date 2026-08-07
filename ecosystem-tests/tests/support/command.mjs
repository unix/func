import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const commandTimeout = 180_000
const maxBuffer = 20 * 1024 * 1024

export const environment = {
  ...process.env,
  CI: 'true',
  NO_COLOR: '1',
  npm_config_audit: 'false',
  npm_config_fund: 'false',
}

export const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

export const readJson = path => {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export const runCommand = (stage, command, args, cwd, timeout = commandTimeout) => {
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

const commandText = (command, args) => {
  return [command, ...args].join(' ')
}
