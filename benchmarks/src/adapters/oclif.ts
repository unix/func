import { flush, run, settings } from '@oclif/core'
import { ProjectConflict } from './oclif-commands.js'

settings.enableAutoTranspile = false

const fail = (error: unknown): void => {
  const projectError = error instanceof ProjectConflict
  process.stderr.write(
    `error[${projectError ? 'project' : 'benchmark'}]: ${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = projectError ? 3 : 2
}

await run(process.argv.slice(2), import.meta.url)
  .catch(error => fail(error))
  .finally(() => flush())
