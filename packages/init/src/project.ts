import fs from 'fs'
import os from 'os'
import path from 'path'
import { FUNC_TEMPLATE_URL, downloadTemplate } from './template'
import { Loading, PromptSession, color } from './ui'

export const createProject = async (): Promise<void> => {
  const cwd = process.cwd()
  const prompt = new PromptSession()
  const loading = new Loading()
  const name = await promptProjectName(prompt)
  const targetDir = path.resolve(cwd, name)
  let createdTarget = false

  if (fs.existsSync(targetDir)) {
    throw new Error(`Project "${name}" already exists at ${targetDir}.`)
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-func-'))
  const extractedDir = path.join(tempDir, 'template')

  try {
    loading.start(`Downloading ${FUNC_TEMPLATE_URL}`)
    await downloadTemplate(extractedDir)
    loading.succeed()

    fs.mkdirSync(targetDir, { recursive: false })
    createdTarget = true
    copyDirectory(extractedDir, targetDir)

    const packageName = packageNameFromProjectName(name)
    updatePackageMetadata(targetDir, packageName)
    restoreGitignore(targetDir)
    prompt.writeLine('')
    prompt.writeLine(`${color.green('Done.')} Created ${name}.`)
    prompt.writeLine('')
    prompt.writeLine(`  cd ${path.relative(cwd, targetDir) || '.'}`)
    prompt.writeLine('  npm install')
  } catch (error) {
    loading.fail()
    if (createdTarget && fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { force: true, recursive: true })
    }

    throw error
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true })
  }
}

export const packageNameFromProjectName = (name: string): string => {
  const normalized = name.replace(/\\/g, '/').replace(/\/+$/, '')
  const baseName = path.basename(normalized)
  const packageName = baseName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._~-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return packageName || 'func-app'
}

export const promptProjectName = async (prompt: PromptSession): Promise<string> => {
  while (true) {
    const name = (await prompt.text('Project name')).trim()

    try {
      assertProjectName(name)
      return name
    } catch (error) {
      prompt.writeLine(
        color.red(error instanceof Error ? error.message : String(error)),
      )
    }
  }
}

export const assertProjectName = (name: string): void => {
  if (!name.trim()) {
    throw new Error('Project name is required.')
  }

  if (name.startsWith('-')) {
    throw new Error('Project name cannot start with "-".')
  }

  if (path.isAbsolute(name) || name === '.' || name === '..') {
    throw new Error('Project name must be a relative directory name.')
  }

  if (/[\\/]/.test(name)) {
    throw new Error('Project name cannot contain path separators.')
  }
}

export const updatePackageMetadata = (
  targetDir: string,
  packageName: string,
): void => {
  const packagePath = path.join(targetDir, 'package.json')
  if (!fs.existsSync(packagePath)) return

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8')) as Record<
    string,
    unknown
  >
  const bin = resolveBinEntry(pkg.bin)

  pkg.name = packageName
  if (bin) {
    pkg.bin = {
      [packageName]: bin,
    }
  }

  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`)
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

const copyDirectory = (source: string, destination: string): void => {
  const entries = fs.readdirSync(source, { withFileTypes: true })

  entries.forEach(entry => {
    const sourcePath = path.join(source, entry.name)
    const destinationPath = path.join(destination, entry.name)

    if (entry.isDirectory()) {
      fs.mkdirSync(destinationPath)
      copyDirectory(sourcePath, destinationPath)
      return
    }

    if (entry.isSymbolicLink()) {
      fs.symlinkSync(fs.readlinkSync(sourcePath), destinationPath)
      return
    }

    fs.copyFileSync(sourcePath, destinationPath)
    fs.chmodSync(destinationPath, fs.statSync(sourcePath).mode)
  })
}
