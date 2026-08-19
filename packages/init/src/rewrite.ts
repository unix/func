import { SCAFFOLD, ScaffoldException } from '@func/contracts/scaffold-errors'
import fs from 'fs'
import path from 'path'

const PROJECT_PACKAGE_FILES = ['dist', 'package.json', 'README.md', 'tsconfig.json']

export const rewriteDownloadedTemplate = (
  targetDir: string,
  packageName: string,
): void => {
  updatePackageMetadata(targetDir, packageName)
  restoreGitignore(targetDir)
}

const updatePackageMetadata = (targetDir: string, packageName: string): void => {
  const packagePath = path.join(targetDir, 'package.json')
  if (!fs.existsSync(packagePath)) return
  let value: unknown
  try {
    value = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
  } catch (error) {
    throw invalidPackageMetadata(packagePath, nativeError(error))
  }
  if (!isUnknownRecord(value)) {
    throw invalidPackageMetadata(packagePath)
  }
  const pkg = value
  const bin = resolveBinEntry(pkg.bin)
  pkg.name = packageName
  pkg.version = '0.0.0'
  pkg.files = PROJECT_PACKAGE_FILES
  if (bin) {
    pkg.bin = {
      [packageName]: bin,
    }
  }

  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`)
}

const isUnknownRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const invalidPackageMetadata = (
  packagePath: string,
  cause?: Error,
): ScaffoldException =>
  new ScaffoldException(SCAFFOLD.INVALID_PACKAGE_METADATA, {
    ...(cause ? { cause } : {}),
    details: { path: packagePath },
    message: `Invalid package metadata in "${packagePath}".`,
  })

const nativeError = (error: unknown): Error | undefined =>
  error instanceof Error ? error : undefined

const resolveBinEntry = (bin: unknown): string | undefined => {
  if (typeof bin === 'string') return bin
  if (!bin || typeof bin !== 'object' || Array.isArray(bin)) return undefined
  const entries = Object.values(bin)
  const firstEntry = entries.find(entry => typeof entry === 'string')
  return typeof firstEntry === 'string' ? firstEntry : undefined
}

const restoreGitignore = (targetDir: string): void => {
  const npmignorePath = path.join(targetDir, '.npmignore')
  const gitignorePath = path.join(targetDir, '.gitignore')
  if (!fs.existsSync(npmignorePath) || fs.existsSync(gitignorePath)) return
  fs.renameSync(npmignorePath, gitignorePath)
}
