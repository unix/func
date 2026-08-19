import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'func/parser': fileURLToPath(
        new URL('../../packages/core/src/subpath/parser/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
