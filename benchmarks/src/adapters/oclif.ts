import { flush, run, settings } from '@oclif/core'

settings.enableAutoTranspile = false

const fail = (error: unknown): void => {
  process.stderr.write(
    `error[CLI_ERROR]: ${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = 2
}

await run(process.argv.slice(2), import.meta.url)
  .catch(error => fail(error))
  .finally(() => flush())
