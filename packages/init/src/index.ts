import { SCAFFOLD, ScaffoldException } from '@func/contracts/scaffold-errors'
import { createParser } from 'func/parser'
import { createProject } from './project'

interface PackageInfo {
  readonly version: string
}

const isPackageInfo = (value: unknown): value is PackageInfo =>
  typeof value === 'object' &&
  value !== null &&
  'version' in value &&
  typeof value.version === 'string'

const packageValue: unknown = require('../package.json')
if (!isPackageInfo(packageValue)) {
  throw new ScaffoldException(SCAFFOLD.INVALID_PACKAGE_METADATA, {
    details: { package: packageValue },
    message: 'create-func package metadata is invalid.',
  })
}
const pkg = packageValue

const parser = createParser({
  options: {
    help: { alias: 'h', type: Boolean },
    version: { alias: 'v', type: Boolean },
  },
})

export const main = async (argv: string[] = process.argv): Promise<void> => {
  const args = parser.parse(argv.slice(2))
  if (args.options.version) {
    console.log(pkg.version)
    return
  }

  if (args.options.help) {
    printHelp()
    return
  }

  await createProject(resolveProjectName(args.inputs))
}

export const resolveProjectName = (
  subArgs: readonly string[],
): string | undefined => {
  if (subArgs.length > 1) {
    throw new ScaffoldException(SCAFFOLD.MULTIPLE_PROJECT_NAMES, {
      details: { names: subArgs },
      message: 'Only one project name can be provided.',
    })
  }

  return subArgs[0]
}

const printHelp = (): void => {
  console.log(`Usage: create-func [options] [project-name]

Options:
  -h, --help     Output usage information
  -v, --version  Output the version number

Examples:
  npm init func@latest         Prompt for a project name
  npm init func@latest my-app  Create a project without prompting`)
}
