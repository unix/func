import { globSync } from 'node:fs'
import { defineConfig } from 'rolldown'

const input = Object.fromEntries(
  globSync('src/**/*.ts').map(file => [file.slice(4, -3), file]),
)

export default defineConfig({
  input,
  external: id =>
    !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('@func/contracts'),
  platform: 'node',
  preserveEntrySignatures: 'strict',
  transform: {
    target: 'node24',
  },
  tsconfig: './tsconfig.json',
  output: {
    chunkFileNames: 'chunks/[name]-[hash].js',
    dir: 'dist',
    entryFileNames: '[name].js',
    exports: 'named',
    format: 'cjs',
  },
})
