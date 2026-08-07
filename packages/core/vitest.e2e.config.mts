import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    hookTimeout: 120_000,
    include: ['e2e/**/*.test.ts'],
    testTimeout: 30_000,
  },
})
