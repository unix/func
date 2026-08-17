import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

export interface CliLocationOptions {
  bin?: string
  binName?: string
  packageRoot?: string
}

interface PackageManifest {
  bin?: string | Record<string, string>
}

export const resolveCliEntry = (options: CliLocationOptions): string => {
  const packageRoot = resolve(options.packageRoot ?? process.cwd())
  const configured = options.bin ?? manifestBin(packageRoot, options.binName)
  if (typeof configured !== 'string' || !configured.length) {
    throw new TypeError('CLI bin path must be a non-empty string.')
  }

  const entry = isAbsolute(configured)
    ? configured
    : resolve(packageRoot, configured)
  if (!existsSync(entry)) {
    throw new Error(`CLI bin entry does not exist: ${entry}`)
  }

  return entry
}

const manifestBin = (packageRoot: string, binName?: string): string => {
  const manifestPath = join(packageRoot, 'package.json')
  const manifest = parseManifest(manifestPath)
  if (typeof manifest.bin === 'string') return manifest.bin
  if (!manifest.bin || !Object.keys(manifest.bin).length) {
    throw new Error(`Package manifest does not declare a bin entry: ${manifestPath}`)
  }
  if (binName) {
    const entry = manifest.bin[binName]
    if (entry) return entry
    throw new Error(`Package manifest does not declare bin "${binName}".`)
  }

  const entries = Object.entries(manifest.bin)
  if (entries.length === 1) return entries[0][1]
  throw new Error(
    `Package manifest declares multiple bins (${entries.map(([name]) => name).join(', ')}); provide binName.`,
  )
}

const parseManifest = (path: string): PackageManifest => {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!value || typeof value !== 'object') {
    throw new TypeError(`Package manifest must contain an object: ${path}`)
  }

  const bin: unknown = Reflect.get(value, 'bin')
  if (bin === undefined || typeof bin === 'string') return { bin }
  if (typeof bin === 'object' && bin !== null) {
    const entries = Object.entries(bin)
    const normalized: Record<string, string> = {}
    for (const [name, entry] of entries) {
      if (typeof entry !== 'string' || !entry.length) {
        throw new TypeError(
          `Package manifest bin must be a string or string record: ${path}`,
        )
      }
      normalized[name] = entry
    }
    return { bin: normalized }
  }

  throw new TypeError(
    `Package manifest bin must be a string or string record: ${path}`,
  )
}
