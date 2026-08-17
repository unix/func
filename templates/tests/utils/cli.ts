import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCliRunner } from 'func/testing/cli'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export const cli = createCliRunner({ packageRoot })
