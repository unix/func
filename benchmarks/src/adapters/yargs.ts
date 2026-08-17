import yargs, { type ArgumentsCamelCase, type Argv } from 'yargs'
import { hideBin } from 'yargs/helpers'

const profiles = ['local', 'staging', 'production'] as const
const targets = ['development', 'staging', 'production'] as const
const auditFormats = ['summary', 'detailed'] as const
const exportFormats = ['json', 'csv'] as const

interface AppArguments {
  context: boolean
  json: boolean
  profile: string
  trace: boolean
}

interface ProjectArguments extends AppArguments {
  action: 'inspect' | 'sync'
  conflict?: boolean
  dryRun?: boolean
  force?: boolean
  label: string[]
  project?: string
  target: string
}

interface AuditArguments extends AppArguments {
  action: 'export' | 'list'
  format?: string
  includeSystem: boolean
  limit: number
}

class ProjectConflict extends Error {}

const output = (options: AppArguments, data: object, summary: string): void => {
  process.stdout.write(`${options.json ? JSON.stringify(data) : summary}\n`)
}

const appContext = (path: string, options: AppArguments): boolean => {
  if (!options.context) return false
  output(
    options,
    {
      kind: 'context',
      scope: 'app',
      command: path,
      profile: options.profile,
      trace: options.trace,
    },
    `context app ${path} (${options.profile}, trace ${options.trace ? 'on' : 'off'})`,
  )
  return true
}

const auditContext = (
  path: string,
  options: AuditArguments,
  format: string,
): boolean => {
  if (!options.context) return false
  output(
    options,
    {
      kind: 'context',
      scope: 'audit',
      command: path,
      profile: options.profile,
      format,
      limit: options.limit,
    },
    `context audit ${path} (${format}/${options.limit}, ${options.profile})`,
  )
  return true
}

const requiredProject = (value?: string): string => {
  if (value) return value
  throw new Error('Option "--project" is required.')
}

const projectBuilder = (command: Argv) =>
  command
    .positional('action', {
      choices: ['inspect', 'sync'] as const,
      demandOption: true,
      type: 'string',
    })
    .option('project', { description: 'project name', type: 'string' })
    .option('target', {
      alias: 't',
      choices: targets,
      default: 'staging',
      description: 'deployment target',
      type: 'string',
    })
    .option('label', {
      array: true,
      default: [],
      description: 'project label',
      type: 'string',
    })
    .option('dry-run', {
      description: 'preview changes',
      type: 'boolean',
    })
    .option('force', {
      description: 'force synchronization',
      type: 'boolean',
    })
    .option('conflict', {
      description: 'simulate a sync conflict',
      type: 'boolean',
    })
    .conflicts('force', 'dry-run')

const auditBuilder = (command: Argv) =>
  command
    .positional('action', {
      choices: ['list', 'export'] as const,
      demandOption: true,
      type: 'string',
    })
    .option('format', {
      description: 'audit output format',
      type: 'string',
    })
    .option('limit', {
      default: 20,
      description: 'maximum audit entries',
      type: 'number',
    })
    .option('include-system', {
      default: false,
      description: 'include system events',
      type: 'boolean',
    })
    .check(argv => {
      const formats: readonly string[] =
        argv.action === 'export' ? exportFormats : auditFormats
      const format = argv.format ?? (argv.action === 'export' ? 'json' : 'summary')
      if (!formats.includes(format)) {
        throw new Error(`format must be one of: ${formats.join(', ')}.`)
      }
      if (!Number.isInteger(argv.limit)) {
        throw new Error('limit must be an integer.')
      }
      return true
    })

const parser = yargs(hideBin(process.argv))
  .scriptName('benchmark-yargs')
  .option('profile', {
    alias: 'p',
    choices: profiles,
    default: 'local',
    description: 'configuration profile',
    global: true,
    type: 'string',
  })
  .option('json', {
    default: false,
    description: 'write JSON output',
    global: true,
    type: 'boolean',
  })
  .option('trace', {
    default: false,
    description: 'include trace context',
    global: true,
    type: 'boolean',
  })
  .option('context', {
    alias: 'C',
    default: false,
    description: 'show invocation context',
    global: true,
    type: 'boolean',
  })
  .command(
    'status',
    'show application status',
    command => command,
    (argv: ArgumentsCamelCase<AppArguments>) => {
      if (appContext('status', argv)) return
      output(
        argv,
        { kind: 'status', profile: argv.profile, trace: argv.trace },
        `status ${argv.profile} (trace ${argv.trace ? 'on' : 'off'})`,
      )
    },
  )
  .command(
    'project <action>',
    'inspect or sync a project',
    projectBuilder,
    (argv: ArgumentsCamelCase<ProjectArguments>) => {
      const path = `project ${argv.action}`
      if (appContext(path, argv)) return
      const project = requiredProject(argv.project)
      const dryRun = Boolean(argv.dryRun)
      const force = Boolean(argv.force)
      if (argv.action === 'inspect') {
        output(
          argv,
          {
            kind: 'project-inspection',
            project,
            target: argv.target,
            labels: argv.label,
            dryRun,
            profile: argv.profile,
          },
          `inspect ${project} -> ${argv.target} (${argv.label.length} labels, ${argv.profile})`,
        )
        return
      }
      if (argv.conflict) {
        throw new ProjectConflict(`sync conflict for project "${project}".`)
      }
      const mode = dryRun ? 'dry-run' : force ? 'force' : 'safe'
      output(
        argv,
        {
          kind: 'project-sync',
          project,
          target: argv.target,
          labels: argv.label,
          mode,
          profile: argv.profile,
        },
        `sync ${project} -> ${argv.target} (${mode}, ${argv.profile})`,
      )
    },
  )
  .command(
    'audit <action>',
    'list or export audit events',
    auditBuilder,
    (argv: ArgumentsCamelCase<AuditArguments>) => {
      const path = `audit ${argv.action}`
      const moduleFormat = 'summary'
      const format =
        argv.format ?? (argv.action === 'export' ? 'json' : moduleFormat)
      if (
        auditContext(path, argv, argv.action === 'export' ? moduleFormat : format)
      ) {
        return
      }
      if (argv.action === 'list') {
        output(
          argv,
          {
            kind: 'audit-list',
            limit: argv.limit,
            format,
            includeSystem: argv.includeSystem,
            profile: argv.profile,
          },
          `audit list ${argv.limit} (${format}, system ${argv.includeSystem ? 'on' : 'off'}, ${argv.profile})`,
        )
        return
      }
      output(
        argv,
        {
          kind: 'audit-export',
          format,
          moduleFormat,
          limit: argv.limit,
          profile: argv.profile,
        },
        `audit export ${format} (limit ${argv.limit}, module ${moduleFormat})`,
      )
    },
  )
  .demandCommand(1)
  .strictCommands()
  .strictOptions()
  .recommendCommands()
  .exitProcess(false)
  .fail((message, error: Error | undefined) => {
    throw error ?? new Error(message)
  })

const fail = (error: unknown): void => {
  const projectError = error instanceof ProjectConflict
  process.stderr.write(
    `error[${projectError ? 'project' : 'benchmark'}]: ${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = projectError ? 3 : 2
}

try {
  await parser.parseAsync()
} catch (error) {
  fail(error)
}
