import arg from 'arg'
import { build, buildNcc } from './actions/build'
import { dev } from './actions/dev'
import { setup } from './actions/setup'
import { style } from './utils/style'

const pkg = require('../package.json') as {
  name: string
  version: string
}

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
    name: 'build-ncc',
    description: 'bundle project for production with ncc compatibility',
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
  const args = arg(
    {
      '--help': Boolean,
      '--version': Boolean,
      '-h': '--help',
      '-v': '--version',
    },
    {
      argv: rawArgs,
      permissive: true,
    },
  )

  if (args['--version']) {
    console.log(pkg.version)
    return
  }

  const command = args._[0]
  if (args['--help'] || !command) {
    printHelp()
    return
  }

  const commandIndex = rawArgs.indexOf(command)
  const commandArgs = rawArgs.slice(commandIndex + 1)
  if (command === 'dev') {
    await dev(commandArgs)
    return
  }

  if (command === 'build') {
    await build(commandArgs)
    return
  }

  if (command === 'build-ncc') {
    await buildNcc(commandArgs)
    return
  }

  if (command === 'setup') {
    await setup(commandArgs)
    return
  }

  throw new Error(`Unknown command "${command}".`)
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
