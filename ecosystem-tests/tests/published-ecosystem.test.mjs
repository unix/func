import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { verifyPublicApis } from './support/contracts.mjs'
import { printTestOverview, runTestStage } from './support/reporter.mjs'
import { testWatchBuild } from './support/watch.mjs'
import {
  buildNcc,
  buildRolldown,
  installPublishedPackages,
  verifyFuncgoWorkflows,
} from './support/workflows.mjs'

const testTimeout = 600_000
const testsRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const fixtureRoot = join(testsRoot, 'fixtures', 'full-project')

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

    printTestOverview(projectRoot)

    const latestVersions = {}
    const funcgoBin = join(projectRoot, 'node_modules', 'funcgo', 'dist', 'bin.js')

    await runTestStage(t, 0, () => {
      installPublishedPackages(projectRoot, latestVersions)
    })
    await runTestStage(t, 1, () => {
      verifyPublicApis(projectRoot)
    })
    await runTestStage(t, 2, () => {
      verifyFuncgoWorkflows(projectRoot, funcgoBin, latestVersions)
    })
    await runTestStage(t, 3, () => {
      buildRolldown(projectRoot, funcgoBin)
    })
    await runTestStage(t, 4, () => {
      buildNcc(projectRoot, funcgoBin)
    })
    await runTestStage(t, 5, async () => {
      await testWatchBuild(projectRoot, funcgoBin)
    })
  },
)
