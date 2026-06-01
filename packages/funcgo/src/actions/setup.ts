import arg from 'arg'
import fs from 'fs'
import path from 'path'
import {
  cwd,
  defaultBinName,
  defaultEntries,
  firstBinName,
  packagePath,
  packagePathFromCwd,
  readPackage,
  writePackage,
} from '../utils/paths'
import type { ProjectPackage } from '../utils/paths'

const DEFAULT_OUT_DIR = 'dist'
const DEFAULT_DEV_SCRIPT = 'funcgo dev --'
const DEFAULT_BUILD_SCRIPT = 'funcgo build'

export interface SetupArgs {
  fix: boolean
}

export interface SetupSuggestion {
  message: string
  apply: (pkg: ProjectPackage) => void
}

export const setup = async (argv: string[]): Promise<void> => {
  const args = parseSetupArgs(argv)
  if (!fs.existsSync(packagePath)) {
    throw new Error(`About. Not found ${packagePath}.`)
  }

  const pkg = readPackage()
  const suggestions = collectSetupSuggestions(pkg)
  if (!suggestions.length) {
    console.log('No changes needed.')
    return
  }

  suggestions.forEach((suggestion, index) => {
    console.log(`${index + 1}. ${suggestion.message}`)
  })

  if (!args.fix) {
    return
  }

  suggestions.forEach(suggestion => suggestion.apply(pkg))
  writePackage(pkg)
  console.log('')
  console.log(`Updated ${packagePath}.`)
}

export const parseSetupArgs = (argv: string[]): SetupArgs => {
  const args = arg(
    {
      '--fix': Boolean,
    },
    {
      argv,
    },
  )

  return {
    fix: Boolean(args['--fix']),
  }
}

export const collectSetupSuggestions = (
  pkg: ProjectPackage,
  entry: string | undefined = detectEntry(pkg),
): SetupSuggestion[] => {
  const suggestions: SetupSuggestion[] = []
  const binName = firstBinName(pkg) || defaultBinName(pkg)
  const outDir = pkg.func?.outDir || DEFAULT_OUT_DIR
  const bin = packageBinPath(outDir)

  if (!entry) {
    suggestions.push({
      message: 'Choose an entry file and set package.json#func.entry.',
      apply: nextPkg => {
        nextPkg.func = Object.assign({}, nextPkg.func, {
          entry: 'src/index.ts',
        })
      },
    })
  }

  if (!pkg.func?.entry && entry) {
    suggestions.push({
      message: `Add package.json#func.entry: "${entry}".`,
      apply: nextPkg => {
        nextPkg.func = Object.assign({}, nextPkg.func, {
          entry,
        })
      },
    })
  }

  if (!pkg.func?.outDir) {
    suggestions.push({
      message: `Set package.json#func.outDir: "${DEFAULT_OUT_DIR}".`,
      apply: nextPkg => {
        nextPkg.func = Object.assign({}, nextPkg.func, {
          outDir: DEFAULT_OUT_DIR,
        })
      },
    })
  }

  if (!binName) {
    suggestions.push({
      message: 'Add package.json#name or package.json#bin before setup can infer a command name.',
      apply: () => {},
    })
  }

  if (binName && (!pkg.bin || binValue(pkg, binName) !== bin)) {
    suggestions.push({
      message: `Set package.json#bin.${binName}: "${bin}".`,
      apply: nextPkg => {
        nextPkg.bin = Object.assign({}, objectBin(nextPkg), {
          [binName]: bin,
        })
      },
    })
  }

  if (pkg.scripts?.dev !== DEFAULT_DEV_SCRIPT) {
    suggestions.push({
      message: `Set package.json#scripts.dev: "${DEFAULT_DEV_SCRIPT}".`,
      apply: nextPkg => {
        nextPkg.scripts = Object.assign({}, nextPkg.scripts, {
          dev: DEFAULT_DEV_SCRIPT,
        })
      },
    })
  }

  if (pkg.scripts?.build !== DEFAULT_BUILD_SCRIPT) {
    suggestions.push({
      message: `Set package.json#scripts.build: "${DEFAULT_BUILD_SCRIPT}".`,
      apply: nextPkg => {
        nextPkg.scripts = Object.assign({}, nextPkg.scripts, {
          build: DEFAULT_BUILD_SCRIPT,
        })
      },
    })
  }

  return suggestions
}

const packageBinPath = (outDir: string): string => {
  const normalized = outDir.replace(/\\/g, '/').replace(/\/+$/, '')
  if (normalized.startsWith('.') || normalized.startsWith('/')) {
    return `${normalized}/bin.js`
  }

  return `./${normalized}/bin.js`
}

const detectEntry = (pkg: ProjectPackage): string | undefined => {
  if (pkg.func?.entry) {
    const entry = path.resolve(cwd, pkg.func.entry)
    if (fs.existsSync(entry)) {
      return pkg.func.entry
    }
  }

  const entry = defaultEntries.find(item => fs.existsSync(item))
  if (!entry) {
    return undefined
  }

  return packagePathFromCwd(entry)
}

const binValue = (pkg: ProjectPackage, name: string): string | undefined => {
  if (typeof pkg.bin === 'string') {
    return pkg.bin
  }

  return pkg.bin?.[name]
}

const objectBin = (pkg: ProjectPackage): Record<string, string> => {
  if (!pkg.bin || typeof pkg.bin === 'string') {
    return {}
  }

  return pkg.bin
}
