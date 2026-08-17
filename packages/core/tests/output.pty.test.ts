import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { ReadStream, WriteStream } from 'node:tty'
import { fileURLToPath } from 'node:url'
import { CommandMajor, Handler, Module, Stderr, Stdout } from '../src'
import { FuncProcess, ProcessModule } from '../src/subpath/process'
import type { Writable } from 'node:stream'
import { expect, run, test } from './_test'

const childEnvironmentKey = 'FUNC_OUTPUT_PTY_CHILD'
const inPtyChild = process.env[childEnvironmentKey] === '1'
const ptyRunner = [
  'import os, pty, subprocess, sys',
  'master, slave = pty.openpty()',
  'process = subprocess.Popen(sys.argv[1:], stdin=slave, stdout=slave, stderr=slave, close_fds=True)',
  'os.close(slave)',
  'try:',
  '    while True:',
  '        chunk = os.read(master, 65536)',
  '        if not chunk:',
  '            break',
  '        os.write(sys.stdout.fileno(), chunk)',
  'except OSError:',
  '    pass',
  'finally:',
  '    os.close(master)',
  'sys.exit(process.wait())',
].join('\n')

test.skipIf(process.platform === 'win32')(
  'should preserve native TTY streams and child stdio forwarding',
  async () => {
    if (!inPtyChild) {
      const result = runInPty()
      expect(result.error).toBeUndefined()
      expect(result.status, result.output).toBe(0)
      expect(result.output).toContain('FUNC_OUTPUT_PTY_OK')
      return
    }

    const stdin = new ReadStream(0)
    const stdout = new WriteStream(1)
    const stderr = new WriteStream(2)
    Object.defineProperty(stdin, 'fd', { value: 0 })
    Object.defineProperty(stdout, 'fd', { value: 1 })
    Object.defineProperty(stderr, 'fd', { value: 2 })
    expect(stdin.isTTY).toBe(true)
    expect(stdout.isTTY).toBe(true)
    expect(stderr.isTTY).toBe(true)

    @CommandMajor()
    class Major {
      constructor(private readonly fp: FuncProcess) {}

      @Handler()
      async run(
        @Stdout() injectedStdout: Writable,
        @Stderr() injectedStderr: Writable,
      ) {
        expect(injectedStdout).toBe(stdout)
        expect(injectedStderr).toBe(stderr)
        await this.fp.forward(process.execPath, [
          '-e',
          [
            'const tty =',
            'process.stdin.isTTY === true &&',
            'process.stdout.isTTY === true &&',
            'process.stderr.isTTY === true;',
            'process.exit(tty ? 0 : 42)',
          ].join(' '),
        ])
      }
    }

    @Module({ commands: [Major], imports: [ProcessModule] })
    class AppModule {}

    await run(AppModule, { argv: [], stderr, stdin, stdout })
    stdout.write('FUNC_OUTPUT_PTY_OK\n')
  },
)

const runInPty = () => {
  const vitestPackage = fileURLToPath(import.meta.resolve('vitest/package.json'))
  const vitest = resolve(dirname(vitestPackage), 'vitest.mjs')
  const testFile = fileURLToPath(import.meta.url)
  const command = [process.execPath, vitest, 'run', '--pool', 'threads', testFile]
  const env = { ...process.env, [childEnvironmentKey]: '1' }
  const result = spawnSync('python3', ['-c', ptyRunner, ...command], { env })

  return {
    error: result.error,
    output: Buffer.concat([result.stdout, result.stderr]).toString('utf8'),
    status: result.status,
  }
}
