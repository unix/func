import { defineConfig } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'

export default defineConfig({
  input: {
    index: 'src/index.ts',
    'subpath/completion/index': 'src/subpath/completion/index.ts',
    'subpath/config/index': 'src/subpath/config/index.ts',
    'subpath/help/index': 'src/subpath/help/index.ts',
    'subpath/http/index': 'src/subpath/http/index.ts',
    'subpath/http/testing/index': 'src/subpath/http/testing/index.ts',
    'subpath/invoke/index': 'src/subpath/invoke/index.ts',
    'subpath/json-output/index': 'src/subpath/json-output/index.ts',
    'subpath/log/index': 'src/subpath/log/index.ts',
    'subpath/net/index': 'src/subpath/net/index.ts',
    'subpath/net/testing/index': 'src/subpath/net/testing/index.ts',
    'subpath/parser/index': 'src/subpath/parser/index.ts',
    'subpath/process/index': 'src/subpath/process/index.ts',
    'subpath/process/testing/index': 'src/subpath/process/testing/index.ts',
    'subpath/signals/index': 'src/subpath/signals/index.ts',
    'subpath/testing/index': 'src/subpath/testing/index.ts',
    'subpath/testing/cli/index': 'src/subpath/testing/cli/index.ts',
    'subpath/testing/fixtures/index': 'src/subpath/testing/fixtures/index.ts',
    'subpath/testing/pty/index': 'src/subpath/testing/pty/index.ts',
  },
  external: ['reflect-metadata/lite', /^node:/],
  platform: 'node',
  plugins: [
    dts({
      compilerOptions: {
        module: 'esnext',
        moduleResolution: 'bundler',
        paths: {
          '@func/contracts/*': ['../contracts/src/*'],
        },
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
