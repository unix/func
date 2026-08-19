import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const CACHE_VERSION = 1
const GENERATION_RETENTION_MS = 24 * 60 * 60 * 1000
const REMOVE_RETRIES = 3
const REMOVE_RETRY_DELAY_MS = 50
const CACHE_DIRECTORY = path.join('node_modules', '.cache', 'funcgo')
const CONTROL_FILES = [
  'bun.lock',
  'bun.lockb',
  'package-lock.json',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'yarn.lock',
]
const INSTALL_METADATA_FILES = [
  path.join('node_modules', '.modules.yaml'),
  path.join('node_modules', '.package-lock.json'),
]
const funcgoPackage: unknown = require('../../package.json')
const rolldownPackage: unknown = require('rolldown/package.json')
const typescriptPackage: unknown = require('typescript/package.json')

interface CacheState {
  generation: string
}

interface CacheManifest {
  files: FileSnapshot[]
  signature: string
  version: typeof CACHE_VERSION
}

interface FileSnapshot {
  exists: boolean
  file: string
  modified?: string
  size?: string
}

interface PackageMetadata {
  version: string
}

export interface DevBundle {
  cacheDirectory: string
  compileCache: string
  cwd: string
  entry: string
  file: string
  generation: string
  hit: boolean
  output: string
  signature: string
}

export interface PrepareDevBundleOptions {
  cacheRoot?: string
  cwd: string
  entry: string
}

export const prepareDevBundle = (options: PrepareDevBundleOptions): DevBundle => {
  const cacheRoot = resolveCacheRoot(options)
  const cacheDirectory = path.join(cacheRoot, 'dev', cacheKey(options.entry))
  const bundles = path.join(cacheDirectory, 'bundles')
  const compileCache = path.join(cacheDirectory, 'node-compile-cache')
  const signature = cacheSignature(options)
  fs.mkdirSync(bundles, { recursive: true })

  const cached = cachedBundle(
    cacheDirectory,
    bundles,
    compileCache,
    signature,
    options,
  )
  if (cached) return cached
  const output = fs.mkdtempSync(path.join(bundles, 'bundle-'))

  return {
    cacheDirectory,
    compileCache,
    cwd: path.resolve(options.cwd),
    entry: path.resolve(options.entry),
    file: path.join(output, 'index.js'),
    generation: path.basename(output),
    hit: false,
    output,
    signature,
  }
}

export const commitDevBundle = (
  bundle: DevBundle,
  files: readonly string[],
): void => {
  if (bundle.hit) return
  if (!fs.existsSync(bundle.file)) {
    throw new TypeError(`Dev bundle was not written to "${bundle.file}".`)
  }

  const manifest: CacheManifest = {
    files: cacheFiles(files, bundle).map(snapshotFile),
    signature: bundle.signature,
    version: CACHE_VERSION,
  }
  writeJsonAtomically(path.join(bundle.output, 'manifest.json'), manifest)
  writeJsonAtomically(path.join(bundle.cacheDirectory, 'current.json'), {
    generation: bundle.generation,
  } satisfies CacheState)
  removeOtherGenerations(bundle)
}

export const discardDevBundle = (bundle: DevBundle): void => {
  if (bundle.hit) return
  if (!isGenerationPath(bundle)) return
  removeDirectory(bundle.output)
}

const cachedBundle = (
  cacheDirectory: string,
  bundles: string,
  compileCache: string,
  signature: string,
  options: PrepareDevBundleOptions,
): DevBundle | undefined => {
  const state = readState(path.join(cacheDirectory, 'current.json'))
  if (!state) return undefined
  const output = path.join(bundles, state.generation)
  if (path.dirname(output) !== bundles) return undefined
  const file = path.join(output, 'index.js')
  const manifest = readManifest(path.join(output, 'manifest.json'))
  if (manifest?.signature !== signature) return undefined
  if (!fs.existsSync(file)) return undefined
  if (!manifest.files.every(matchesSnapshot)) return undefined

  return {
    cacheDirectory,
    compileCache,
    cwd: path.resolve(options.cwd),
    entry: path.resolve(options.entry),
    file,
    generation: state.generation,
    hit: true,
    output,
    signature,
  }
}

const cacheFiles = (files: readonly string[], bundle: DevBundle): string[] => {
  const result = new Set<string>()
  files.forEach(file => {
    const normalized = moduleFile(file)
    if (normalized) result.add(normalized)
  })

  ancestorDirectories(bundle.cwd).forEach(directory => {
    CONTROL_FILES.forEach(file => result.add(path.join(directory, file)))
    INSTALL_METADATA_FILES.forEach(file => result.add(path.join(directory, file)))
  })

  ancestorDirectories(path.dirname(bundle.entry)).forEach(directory => {
    result.add(path.join(directory, 'tsconfig.json'))
  })

  return [...result].sort()
}

const snapshotFile = (file: string): FileSnapshot => {
  try {
    const stat = fs.statSync(file, { bigint: true })
    return {
      exists: true,
      file,
      modified: stat.mtimeNs.toString(),
      size: stat.size.toString(),
    }
  } catch {
    return { exists: false, file }
  }
}

const matchesSnapshot = (snapshot: FileSnapshot): boolean => {
  const current = snapshotFile(snapshot.file)
  if (current.exists !== snapshot.exists) return false
  if (!current.exists) return true
  return current.modified === snapshot.modified && current.size === snapshot.size
}

const moduleFile = (id: string): string | undefined => {
  if (!id || id.startsWith('\0')) return undefined
  const file = id.startsWith('file:') ? fileURLToPath(id) : id.split('?', 1)[0]
  if (!path.isAbsolute(file)) return undefined
  return path.normalize(file)
}

const ancestorDirectories = (directory: string): string[] => {
  const directories: string[] = []
  let current = path.resolve(directory)

  for (;;) {
    directories.push(current)
    const parent = path.dirname(current)
    if (parent === current) return directories
    current = parent
  }
}

const cacheKey = (entry: string): string => {
  return digest(path.resolve(entry)).slice(0, 16)
}

const cacheSignature = (options: PrepareDevBundleOptions): string => {
  return digest(
    JSON.stringify({
      cacheVersion: CACHE_VERSION,
      cwd: path.resolve(options.cwd),
      entry: path.resolve(options.entry),
      funcgo: packageVersion(funcgoPackage),
      node: process.versions.node,
      rolldown: packageVersion(rolldownPackage),
      typescript: packageVersion(typescriptPackage),
    }),
  )
}

const packageVersion = (metadata: unknown): string => {
  if (!isPackageMetadata(metadata)) return 'unknown'
  return metadata.version
}

const isPackageMetadata = (value: unknown): value is PackageMetadata => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    typeof value.version === 'string'
  )
}

const resolveCacheRoot = (options: PrepareDevBundleOptions): string => {
  const configured = options.cacheRoot ?? process.env.FUNCGO_CACHE_DIR
  if (configured) {
    const cacheRoot = path.resolve(options.cwd, configured)
    fs.mkdirSync(cacheRoot, { recursive: true })
    return cacheRoot
  }

  const projectCache = path.join(options.cwd, CACHE_DIRECTORY)
  try {
    fs.mkdirSync(projectCache, { recursive: true })
    return projectCache
  } catch {
    const fallback = path.join(
      os.tmpdir(),
      'funcgo-cache',
      digest(path.resolve(options.cwd)).slice(0, 16),
    )
    fs.mkdirSync(fallback, { recursive: true })
    return fallback
  }
}

const readState = (file: string): CacheState | undefined => {
  const value = readJson(file)
  if (!isRecord(value) || typeof value.generation !== 'string') return undefined
  if (!value.generation.startsWith('bundle-')) return undefined
  return { generation: value.generation }
}

const readManifest = (file: string): CacheManifest | undefined => {
  const value = readJson(file)
  if (!isRecord(value)) return undefined
  if (value.version !== CACHE_VERSION) return undefined
  if (typeof value.signature !== 'string') return undefined
  if (!Array.isArray(value.files) || !value.files.every(isFileSnapshot))
    return undefined

  return {
    files: value.files,
    signature: value.signature,
    version: value.version,
  }
}

const isFileSnapshot = (value: unknown): value is FileSnapshot => {
  if (!isRecord(value)) return false
  if (typeof value.exists !== 'boolean' || typeof value.file !== 'string')
    return false
  if (!value.exists) return true
  return typeof value.modified === 'string' && typeof value.size === 'string'
}

const readJson = (file: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    return undefined
  }
}

const writeJsonAtomically = (file: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`)
    fs.renameSync(temporary, file)
  } finally {
    fs.rmSync(temporary, { force: true })
  }
}

const removeOtherGenerations = (bundle: DevBundle): void => {
  const bundles = path.dirname(bundle.output)
  const expiredBefore = Date.now() - GENERATION_RETENTION_MS
  try {
    fs.readdirSync(bundles, { withFileTypes: true }).forEach(entry => {
      if (!entry.isDirectory() || entry.name === bundle.generation) return
      if (!entry.name.startsWith('bundle-')) return
      const directory = path.join(bundles, entry.name)
      if (fs.statSync(directory).mtimeMs >= expiredBefore) return
      removeDirectory(directory)
    })
  } catch {
    // Expired cache cleanup must not prevent the current bundle from running.
  }
}

const removeDirectory = (directory: string): void => {
  try {
    fs.rmSync(directory, {
      force: true,
      maxRetries: REMOVE_RETRIES,
      recursive: true,
      retryDelay: REMOVE_RETRY_DELAY_MS,
    })
  } catch {
    // Cache cleanup is best-effort when Windows temporarily locks a file.
  }
}

const isGenerationPath = (bundle: DevBundle): boolean => {
  if (!bundle.generation.startsWith('bundle-')) return false
  return path.dirname(bundle.output) === path.join(bundle.cacheDirectory, 'bundles')
}

const digest = (value: string): string => {
  return crypto.createHash('sha256').update(value).digest('hex')
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}
