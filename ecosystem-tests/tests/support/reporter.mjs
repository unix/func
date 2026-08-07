import { realpathSync } from 'node:fs'

const testStages = [
  {
    loading: 'Resolving and downloading npm packages',
    name: 'installs the latest packages from npm without links',
  },
  {
    loading: 'Verifying CommonJS, ES module, and TypeScript APIs',
    name: 'exposes every CommonJS, ES module, and TypeScript API',
  },
  {
    loading: 'Running funcgo setup and development workflows',
    name: 'runs funcgo help, version, setup, and development workflows',
  },
  {
    loading: 'Building and testing the Rolldown artifact',
    name: 'builds and validates the Rolldown artifact',
  },
  {
    loading: 'Building and testing the ncc artifact',
    name: 'builds and validates the ncc artifact',
  },
  {
    loading: 'Watching files and validating the rebuild',
    name: 'watches, rebuilds, and validates the updated artifact',
  },
]

const funcToolchainPackages = [
  'func',
  'funcgo',
  'rolldown',
  '@vercel/ncc',
  '@parcel/watcher',
  'typescript',
]

const colorsEnabled = Boolean(
  process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb',
)

export const printDownloadedPackages = lockfile => {
  const packages = funcToolchainPackages.flatMap(name => {
    const version = packageVersionFromLock(lockfile, name)
    if (!version) return []

    return [`${name}@${color(32, version)}`]
  })

  printBlock('✓', 'Downloaded func toolchain', packages, 32)
}

export const printTestOverview = projectRoot => {
  printBlock('◆', 'Temporary npm project created', [realpathSync(projectRoot)])
  printBlock(
    '◆',
    'Test plan',
    testStages.map((stage, index) => `${index + 1}. ${stage.name}`),
  )
}

export const runTestStage = (context, index, callback) => {
  const stage = testStages[index]
  printTestStage(index)
  return context.test(stage.name, async () => {
    const startedAt = performance.now()
    console.log(`${color(33, '◇')} ${stage.loading}...`)
    try {
      await callback()
      const duration = formatDuration(performance.now() - startedAt)
      console.log(`${color(32, '✓')} ${stage.loading} ${color(2, `(${duration})`)}`)
    } catch (error) {
      console.log(`${color(31, '✗')} ${stage.loading}`)
      throw error
    }
  })
}

const color = (code, value) => {
  if (!colorsEnabled) return value

  return `\u001B[${code}m${value}\u001B[0m`
}

const formatDuration = milliseconds => {
  if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`

  return `${(milliseconds / 1000).toFixed(2)}s`
}

const packageVersionFromLock = (lockfile, name) => {
  const direct = lockfile.packages[`node_modules/${name}`]
  if (direct?.version) return direct.version

  const suffix = `/node_modules/${name}`
  const nested = Object.entries(lockfile.packages).find(
    ([path, data]) => path.endsWith(suffix) && data.version,
  )

  return nested?.[1].version
}

const printBlock = (symbol, title, details, symbolColor = 36) => {
  console.log('')
  console.log(`${color(symbolColor, symbol)} ${color(1, title)}`)
  details.forEach((detail, index) => {
    const branch = index === details.length - 1 ? '└─' : '├─'
    console.log(`  ${color(2, branch)} ${detail}`)
  })
}

const printTestStage = index => {
  const position = `[${index + 1}/${testStages.length}]`
  console.log('')
  console.log(`${color(36, '▶')} ${color(1, position)} ${testStages[index].name}`)
}
