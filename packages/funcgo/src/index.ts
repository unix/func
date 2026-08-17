import { SCAFFOLD, ScaffoldException } from '@func/contracts/scaffold-errors'
import { build } from './actions/build'
import { dev } from './actions/dev'
import { setup } from './actions/setup'
import { funcgoParser } from './parser'
import { style } from './utils/style'

interface PackageInfo {
  name: string
  version: string
}

const isPackageInfo = (value: unknown): value is PackageInfo =>
  isUnknownRecord(value) &&
  typeof value.name === 'string' &&
  typeof value.version === 'string'

const isUnknownRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const packageValue: unknown = require('../package.json')
if (!isPackageInfo(packageValue)) {
  throw new ScaffoldException(SCAFFOLD.INVALID_PACKAGE_METADATA, {
    details: { package: packageValue },
    message: 'funcgo package metadata is invalid.',
  })
}
const pkg = packageValue

const commands = [
  {
    name: 'dev',
    description: 'run project entry with local TypeScript runtime',
  },
  {
    name: 'build',
    description: 'bundle project for production with Rolldown',
  },
  {
    name: 'setup',
    description: 'inspect and prepare func project configuration',
  },
]

const options = [
  {
    name: 'help',
    alias: 'h',
    description: 'help',
  },
  {
    name: 'version',
    alias: 'v',
    description: 'version',
  },
]

export const main = async (argv: string[] = process.argv): Promise<void> => {
  const rawArgs = argv.slice(2)
  const args = funcgoParser.parse(rawArgs)

  if (args.options.version) {
    console.log(pkg.version)
    return
  }

  if (args.options.help || !args.command) {
    printHelp()
    return
  }

  if (args.command === 'dev') {
    await dev({ file: args.options.file, userArgs: args.inputs.slice() })
    return
  }

  if (args.command === 'build') {
    await build({
      external: args.options.external.slice(),
      file: args.options.file,
      out: args.options.out,
      watch: args.options.watch,
      watchPaths: args.options.watchPaths.slice(),
    })
    return
  }

  await setup({ fix: args.options.fix })
}

const printHelp = (): void => {
  console.log(style.heading(pkg.name.toUpperCase()))
  console.log('')

  commands.forEach(command => {
    console.log(
      `  ${style.accent(command.name)}${style.dim(' <command>')}${showDesc(command.description)}`,
    )
  })

  console.log('')

  options.forEach(option => {
    const alias = option.alias ? style.dim(` -${option.alias}`) : ''
    console.log(
      `  ${style.accent(`--${option.name}`)}${alias}${style.dim(' <option>')}${showDesc(option.description)}`,
    )
  })

  console.log('')
}

const showDesc = (desc: string): string => (desc ? style.dim(` --  ${desc}`) : '')
