import { SCAFFOLD, formatScaffoldErrorCode } from '@func/contracts/scaffold-errors'
import { describe, expect, test } from 'vitest'
import { run } from '../src/utils/command'

describe('run', () => {
  test('passes arguments directly without shell interpretation', async () => {
    const argument = 'value with spaces & (shell)'
    await run(
      process.execPath,
      [
        '-e',
        `if (process.argv[1] !== ${JSON.stringify(argument)}) process.exit(1)`,
        argument,
      ],
      { stdio: 'ignore' },
    )
  })

  test('reports unsuccessful child commands with a scaffold error code', async () => {
    await expect(
      run(process.execPath, ['-e', 'process.exit(2)'], {
        shell: false,
        stdio: 'ignore',
      }),
    ).rejects.toMatchObject({
      code: formatScaffoldErrorCode(SCAFFOLD.COMMAND_FAILED),
      details: {
        command: process.execPath,
        exitCode: 2,
        signal: null,
      },
      exitCode: 2,
    })
  })
})
