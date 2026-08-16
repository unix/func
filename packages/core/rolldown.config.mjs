import { defineConfig } from 'rolldown'

export default defineConfig({
  input: {
    completion: 'src/subpath/completion/index.ts',
    config: 'src/subpath/config/index.ts',
    help: 'src/subpath/help/index.ts',
    index: 'src/index.ts',
    invoke: 'src/subpath/invoke/index.ts',
    log: 'src/subpath/log/index.ts',
    signals: 'src/subpath/signals/index.ts',
    testing: 'src/subpath/testing/index.ts',
  },
  external: ['reflect-metadata/lite'],
  platform: 'node',
  preserveEntrySignatures: 'strict',
  transform: {
    target: 'node24',
  },
  tsconfig: './tsconfig.json',
  output: {
    chunkFileNames: 'chunks/[name]-[hash].mjs',
    dir: 'dist',
    entryFileNames: '[name].mjs',
    format: 'esm',
    minify: false,
  },
})
