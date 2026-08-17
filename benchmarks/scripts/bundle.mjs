import { spawnSync } from 'node:child_process'
import { chmod, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { extname, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'

const benchmarkRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const compiledRoot = join(benchmarkRoot, '.build', 'adapters')
const outputRoot = join(benchmarkRoot, 'dist')
const frameworks = ['commander', 'func-parser', 'yargs', 'cac']

await rm(outputRoot, { force: true, recursive: true })
await mkdir(outputRoot, { recursive: true })

const funcDirectory = join(outputRoot, 'func')
const funcgoResult = spawnSync(
  'pnpm',
  [
    'exec',
    'funcgo',
    'build',
    '--file',
    'src/adapters/func.ts',
    '--out',
    'dist/func',
  ],
  {
    cwd: benchmarkRoot,
    encoding: 'utf8',
  },
)
if (funcgoResult.error) throw funcgoResult.error
if (funcgoResult.status !== 0) {
  throw new Error(
    funcgoResult.stderr || funcgoResult.stdout || 'funcgo build failed',
  )
}
await writeFile(join(funcDirectory, 'package.json'), '{"type":"commonjs"}\n')

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

for (const framework of [...frameworks, 'func', 'oclif']) {
  await writeGzipArtifacts(join(outputRoot, framework))
}

async function writeGzipArtifacts(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await writeGzipArtifacts(path)
      continue
    }
    if (!['.cjs', '.js', '.mjs'].includes(extname(entry.name))) continue
    const content = await readFile(path)
    await writeFile(`${path}.gz`, gzipSync(content, { level: 9 }))
  }
}
