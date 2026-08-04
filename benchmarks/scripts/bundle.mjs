import { chmod, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const benchmarkRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const compiledRoot = join(benchmarkRoot, '.build', 'adapters')
const outputRoot = join(benchmarkRoot, 'dist')
const frameworks = ['func', 'commander', 'yargs', 'cac']

await rm(outputRoot, { force: true, recursive: true })
await mkdir(outputRoot, { recursive: true })

const commonOptions = {
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  bundle: true,
  format: 'esm',
  legalComments: 'none',
  logLevel: 'warning',
  metafile: true,
  minify: true,
  platform: 'node',
  sourcemap: false,
  target: 'node24',
  treeShaking: true,
}

const writeMetafile = async (outputDirectory, metafile) => {
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(
    join(outputDirectory, 'metafile.json'),
    `${JSON.stringify(metafile, null, 2)}\n`,
  )
}

for (const framework of frameworks) {
  const outputDirectory = join(outputRoot, framework)
  const result = await build({
    ...commonOptions,
    entryPoints: [join(compiledRoot, `${framework}.js`)],
    outfile: join(outputDirectory, 'bin.mjs'),
  })
  await writeMetafile(outputDirectory, result.metafile)
  await chmod(join(outputDirectory, 'bin.mjs'), 0o755)
}

const oclifDirectory = join(outputRoot, 'oclif')
const oclifResult = await build({
  ...commonOptions,
  chunkNames: 'chunks/[name]-[hash]',
  entryNames: '[name]',
  entryPoints: {
    bin: join(compiledRoot, 'oclif.js'),
    commands: join(compiledRoot, 'oclif-commands.js'),
  },
  external: ['typescript'],
  outExtension: { '.js': '.mjs' },
  outdir: oclifDirectory,
  splitting: true,
})
await writeMetafile(oclifDirectory, oclifResult.metafile)
await chmod(join(oclifDirectory, 'bin.mjs'), 0o755)
