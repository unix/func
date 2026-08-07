import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['e2e/**/*.test.ts'],
    retry: 2,
    testTimeout: 300_000,
  },
})
