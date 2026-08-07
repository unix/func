import { defineConfig } from 'rolldown'

export default defineConfig({
  input: 'src/index.ts',
  external: ['arg', 'reflect-metadata'],
  platform: 'node',
  preserveEntrySignatures: 'strict',
  transform: {
    target: 'node20.12',
  },
  tsconfig: './tsconfig.json',
  output: [
    {
      exports: 'named',
      file: 'dist/index.js',
      format: 'cjs',
      minify: false,
    },
    {
      file: 'dist/index.mjs',
      format: 'esm',
      minify: false,
    },
  ],
})
