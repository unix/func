import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: {
    decorator: {
      emitDecoratorMetadata: true,
      legacy: true,
    },
    target: 'es2022',
  },
  resolve: {
    alias: [
      {
        find: 'func/testing/fixtures',
        replacement: fileURLToPath(
          new URL('../core/src/subpath/testing/fixtures/index.ts', import.meta.url),
        ),
      },
      {
        find: 'func/testing',
        replacement: fileURLToPath(
          new URL('../core/src/subpath/testing/index.ts', import.meta.url),
        ),
      },
      {
        find: 'func/help',
        replacement: fileURLToPath(
          new URL('../core/src/subpath/help/index.ts', import.meta.url),
        ),
      },
      {
        find: 'func',
        replacement: fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      },
    ],
  },
  test: {
    include: ['tests/commands/**/*.test.ts'],
  },
})
