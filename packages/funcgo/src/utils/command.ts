import { spawn } from 'child_process'

export interface RunOptions {
  cwd?: string
  shell?: boolean
  stdio?: 'inherit' | 'ignore' | 'pipe'
}

export const run = (
  command: string,
  args: string[] = [],
  options: RunOptions = {},
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: options.shell || process.platform === 'win32',
      stdio: options.stdio || 'inherit',
    })

    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Command failed: ${command} ${args.join(' ')}`.trim()))
    })
  })
}
