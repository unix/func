import { defineConfig } from 'rolldown'

const application = {
  input: {
    completion: 'src/subpath/completion/index.ts',
    config: 'src/subpath/config/index.ts',
    help: 'src/subpath/help/index.ts',
    http: 'src/subpath/http/index.ts',
    'http-testing': 'src/subpath/http/testing/index.ts',
    index: 'src/index.ts',
    invoke: 'src/subpath/invoke/index.ts',
    'json-output': 'src/subpath/json-output/index.ts',
    log: 'src/subpath/log/index.ts',
    net: 'src/subpath/net/index.ts',
    'net-testing': 'src/subpath/net/testing/index.ts',
    process: 'src/subpath/process/index.ts',
    'process-testing': 'src/subpath/process/testing/index.ts',
    signals: 'src/subpath/signals/index.ts',
    testing: 'src/subpath/testing/index.ts',
    'testing-cli': 'src/subpath/testing/cli/index.ts',
    'testing-fixtures': 'src/subpath/testing/fixtures/index.ts',
    'testing-pty': 'src/subpath/testing/pty/index.ts',
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
}

const parser = format => ({
  input: 'src/subpath/parser/index.ts',
  platform: 'node',
  preserveEntrySignatures: 'strict',
  transform: {
    target: 'node24',
  },
  tsconfig: './tsconfig.json',
  output: {
    codeSplitting: false,
    exports: 'named',
    file: `dist/parser.${format === 'esm' ? 'mjs' : 'cjs'}`,
    format,
    minify: true,
  },
})

export default defineConfig([application, parser('esm'), parser('cjs')])
