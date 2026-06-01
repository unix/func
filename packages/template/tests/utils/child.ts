import { spawn } from 'child_process'
import type { SpawnOptions } from 'child_process'
import { bin } from './metadata'

export const spawnCli = async (args: string[] = [], opts: SpawnOptions = {}) => {
  return new Promise<string>((resolve, reject) => {
    const childOpts = { stdio: 'pipe', ...opts }
    const stderr: Buffer[] = []
    const stdout: Buffer[] = []
    const child = spawn(process.execPath, [bin, ...args], childOpts)

    if (childOpts.stdio === 'pipe') {
      child.stderr.on('data', err => stderr.push(err))
      child.stdout.on('data', data => stdout.push(data))
    }

    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve(stdout.map(line => line.toString()).join(''))
        return
      }

      const errorLogs = stderr.map(line => line.toString()).join('')
      if (childOpts.stdio !== 'inherit') {
        reject(new Error(`Exited with ${code || signal}\n${errorLogs}`))
        return
      }

      reject(new Error(`Exited with ${code || signal}`))
    })
  })
}
