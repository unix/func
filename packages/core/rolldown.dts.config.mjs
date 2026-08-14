import { defineConfig } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'

export default defineConfig({
  input: {
    index: 'src/index.ts',
    'subpath/config/index': 'src/subpath/config/index.ts',
    'subpath/help/index': 'src/subpath/help/index.ts',
    'subpath/log/index': 'src/subpath/log/index.ts',
    'subpath/testing/index': 'src/subpath/testing/index.ts',
  },
  external: ['arg', 'reflect-metadata/lite', /^node:/],
  platform: 'node',
  plugins: [
    dts({
      compilerOptions: {
        module: 'esnext',
        moduleResolution: 'bundler',
      },
      cwd: import.meta.dirname,
      emitDtsOnly: true,
      generator: 'tsc',
      resolver: 'tsc',
      tsconfig: './tsconfig.build.json',
    }),
  ],
  preserveEntrySignatures: 'strict',
  output: {
    chunkFileNames: 'chunks/[name]-[hash].js',
    dir: 'dist/types',
    entryFileNames: '[name].js',
    format: 'esm',
  },
})
