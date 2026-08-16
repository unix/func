import fs from 'fs'
import path from 'path'

export const cwd = process.cwd()

export const packagePath = path.join(cwd, 'package.json')

export interface FuncConfig {
  entry?: string
  outDir?: string
}

export interface ProjectPackage {
  [key: string]: unknown
  name?: string
  bin?: string | Record<string, string>
  scripts?: Record<string, string>
  packageManager?: string
  func?: FuncConfig
}

export const defaultEntries = [
  path.join(cwd, 'src', 'index.ts'),
  path.join(cwd, 'index.ts'),
]

export const resolveEntry = (file?: string): string | undefined => {
  if (file) return path.resolve(cwd, file)
  const pkg = readPackage()
  if (pkg.func?.entry) {
    const entry = path.resolve(cwd, pkg.func.entry)
    if (fs.existsSync(entry)) return entry
  }

  return defaultEntries.find(item => fs.existsSync(item))
}

export const readPackage = (): ProjectPackage => {
  const value: unknown = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
  if (isProjectPackage(value)) return value
  throw new TypeError(`Invalid package metadata in "${packagePath}".`)
}

const isProjectPackage = (value: unknown): value is ProjectPackage =>
  typeof value === 'object' && value !== null

export const writePackage = (pkg: ProjectPackage): void => {
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`)
}

export const packagePathFromCwd = (target: string): string => {
  return path.relative(cwd, target).replace(/\\/g, '/')
}

export const defaultBinName = (pkg: ProjectPackage): string | undefined => {
  if (!pkg.name) return undefined
  const parts = pkg.name.split('/')
  return parts[parts.length - 1]
}

export const firstBinName = (pkg: ProjectPackage): string | undefined => {
  if (typeof pkg.bin === 'string') return defaultBinName(pkg)
  if (pkg.bin) return Object.keys(pkg.bin)[0]
  return defaultBinName(pkg)
}
