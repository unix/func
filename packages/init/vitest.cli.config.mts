import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: 'func/testing/cli',
        replacement: fileURLToPath(
          new URL('../core/src/subpath/testing/cli/index.ts', import.meta.url),
        ),
      },
      {
        find: 'func/testing/fixtures',
        replacement: fileURLToPath(
          new URL('../core/src/subpath/testing/fixtures/index.ts', import.meta.url),
        ),
      },
    ],
  },
  test: {
    include: ['tests/cli/**/*.test.ts'],
    retry: 2,
    testTimeout: 300_000,
  },
})
