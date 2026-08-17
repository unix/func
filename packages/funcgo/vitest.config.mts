import swc from 'unplugin-swc'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    swc.vite({
      tsconfigFile: './tsconfig.json',
    }),
  ],
  resolve: {
    alias: {
      'func/parser': fileURLToPath(
        new URL('../core/src/subpath/parser/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
