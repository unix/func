import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { acceptanceCases } from '../src/acceptance-cases.js'
import { frameworks } from '../src/frameworks.js'

const benchmarkRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

describe.each(frameworks)('%s acceptance', framework => {
  test.each(acceptanceCases)('$id', acceptanceCase => {
    const result = spawnSync(
      process.execPath,
      [join(benchmarkRoot, 'dist', framework, 'bin.mjs'), ...acceptanceCase.args],
      {
        cwd: benchmarkRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NO_COLOR: '1',
        },
        timeout: 10_000,
      },
    )

    expect(result.error).toBeUndefined()
    if (!acceptanceCase.success) {
      expect(result.status).not.toBe(0)
      expect(result.stderr.toLowerCase()).toContain(
        acceptanceCase.errorIncludes.toLowerCase(),
      )
      return
    }

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    if (acceptanceCase.expectedJson) {
      expect(JSON.parse(result.stdout)).toEqual(acceptanceCase.expectedJson)
      return
    }

    expect(result.stdout.trim()).toBe(acceptanceCase.expectedText)
  })
})
