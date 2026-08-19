import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: {
    decorator: {
      emitDecoratorMetadata: true,
      legacy: true,
    },
    target: 'es2022',
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
