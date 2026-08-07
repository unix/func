import fs from 'fs'
import path from 'path'

const PROJECT_PACKAGE_FILES = ['dist', 'package.json', 'README.md', 'tsconfig.json']
const APP_CONFIG_PATH = ['src', 'config.ts']

export const rewriteDownloadedTemplate = (
  targetDir: string,
  packageName: string,
): void => {
  updatePackageMetadata(targetDir, packageName)
  updateAppName(targetDir, packageName)
  restoreGitignore(targetDir)
}

const updatePackageMetadata = (targetDir: string, packageName: string): void => {
  const packagePath = path.join(targetDir, 'package.json')
  if (!fs.existsSync(packagePath)) return

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8')) as Record<
    string,
    unknown
  >
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

const updateAppName = (targetDir: string, packageName: string): void => {
  const configPath = path.join(targetDir, ...APP_CONFIG_PATH)
  if (!fs.existsSync(configPath)) return

  const source = fs.readFileSync(configPath, 'utf-8')
  const output = source.replace(
    /^export const appName = .*$/m,
    `export const appName = '${packageName}'`,
  )
  if (source === output) return

  fs.writeFileSync(configPath, output)
}

const resolveBinEntry = (bin: unknown): string | undefined => {
  if (typeof bin === 'string') {
    return bin
  }

  if (!bin || typeof bin !== 'object' || Array.isArray(bin)) {
    return undefined
  }

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
