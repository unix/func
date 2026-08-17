import { cac } from 'cac'

const profiles = ['local', 'staging', 'production']
const targets = ['development', 'staging', 'production']
const auditFormats = ['summary', 'detailed']
const exportFormats = ['json', 'csv']

interface AppOptions extends Record<string, unknown> {
  context?: boolean
  json?: boolean
  profile?: string
  trace?: boolean
}

class ProjectConflict extends Error {}

const cli = cac('benchmark-cac')

cli
  .option('-p, --profile <profile>', 'configuration profile', {
    default: 'local',
  })
  .option('--json', 'write JSON output')
  .option('--trace', 'include trace context')
  .option('-C, --context', 'show invocation context')

cli.command('status', 'show application status').action((options: AppOptions) => {
  const profile = oneOf(options.profile, profiles, 'profile')
  if (appContext('status', options, profile)) return
  output(
    options,
    { kind: 'status', profile, trace: Boolean(options.trace) },
    `status ${profile} (trace ${options.trace ? 'on' : 'off'})`,
  )
})

cli
  .command('project <action>', 'inspect or sync a project')
  .option('--project <name>', 'project name')
  .option('-t, --target <target>', 'deployment target', { default: 'staging' })
  .option('--label <label>', 'project label')
  .option('--dry-run', 'preview changes')
  .option('--force', 'force synchronization')
  .option('--conflict', 'simulate a sync conflict')
  .action((actionInput: string, options: AppOptions) => {
    const action = oneOf(actionInput, ['inspect', 'sync'], 'action')
    const profile = oneOf(options.profile, profiles, 'profile')
    const path = `project ${action}`
    if (appContext(path, options, profile)) return
    const project = required(options.project, 'project')
    const target = oneOf(options.target, targets, 'target')
    const labels = list(options.label)
    const dryRun = Boolean(options.dryRun)
    const force = Boolean(options.force)
    if (dryRun && force) {
      throw new Error('--force cannot be used with --dry-run.')
    }
    if (action === 'inspect') {
      output(
        options,
        {
          kind: 'project-inspection',
          project,
          target,
          labels,
          dryRun,
          profile,
        },
        `inspect ${project} -> ${target} (${labels.length} labels, ${profile})`,
      )
      return
    }
    if (options.conflict) {
      throw new ProjectConflict(`sync conflict for project "${project}".`)
    }
    const mode = dryRun ? 'dry-run' : force ? 'force' : 'safe'
    output(
      options,
      { kind: 'project-sync', project, target, labels, mode, profile },
      `sync ${project} -> ${target} (${mode}, ${profile})`,
    )
  })

cli
  .command('audit <action>', 'list or export audit events')
  .option('--format <format>', 'audit output format')
  .option('--limit <count>', 'maximum audit entries', { default: 20 })
  .option('--include-system', 'include system events')
  .action((actionInput: string, options: AppOptions) => {
    const action = oneOf(actionInput, ['list', 'export'], 'action')
    const profile = oneOf(options.profile, profiles, 'profile')
    const moduleFormat = 'summary'
    const formats = action === 'export' ? exportFormats : auditFormats
    const defaultFormat = action === 'export' ? 'json' : moduleFormat
    const format = oneOf(options.format ?? defaultFormat, formats, 'format')
    const limit = integer(options.limit, 'limit')
    const path = `audit ${action}`
    if (
      auditContext(
        path,
        options,
        profile,
        action === 'export' ? moduleFormat : format,
        limit,
      )
    ) {
      return
    }
    if (action === 'list') {
      const includeSystem = Boolean(options.includeSystem)
      output(
        options,
        {
          kind: 'audit-list',
          limit,
          format,
          includeSystem,
          profile,
        },
        `audit list ${limit} (${format}, system ${includeSystem ? 'on' : 'off'}, ${profile})`,
      )
      return
    }
    output(
      options,
      {
        kind: 'audit-export',
        format,
        moduleFormat,
        limit,
        profile,
      },
      `audit export ${format} (limit ${limit}, module ${moduleFormat})`,
    )
  })

cli.help()

const required = (value: unknown, label: string): string => {
  if (typeof value === 'string' && value) return value
  throw new Error(`Option "--${label}" is required.`)
}

const oneOf = (value: unknown, values: string[], label: string): string => {
  if (typeof value === 'string' && values.includes(value)) return value
  throw new Error(`${label} must be one of: ${values.join(', ')}.`)
}

const integer = (value: unknown, label: string): number => {
  const parsed = Number(value)
  if (Number.isInteger(parsed)) return parsed
  throw new Error(`${label} must be an integer.`)
}

const list = (value: unknown): string[] => {
  if (value === undefined) return []
  if (Array.isArray(value)) return value.map(String)
  return [String(value)]
}

const output = (options: AppOptions, data: object, summary: string): void => {
  process.stdout.write(`${options.json ? JSON.stringify(data) : summary}\n`)
}

const appContext = (path: string, options: AppOptions, profile: string): boolean => {
  if (!options.context) return false
  output(
    options,
    {
      kind: 'context',
      scope: 'app',
      command: path,
      profile,
      trace: Boolean(options.trace),
    },
    `context app ${path} (${profile}, trace ${options.trace ? 'on' : 'off'})`,
  )
  return true
}

const auditContext = (
  path: string,
  options: AppOptions,
  profile: string,
  format: string,
  limit: number,
): boolean => {
  if (!options.context) return false
  output(
    options,
    { kind: 'context', scope: 'audit', command: path, profile, format, limit },
    `context audit ${path} (${format}/${limit}, ${profile})`,
  )
  return true
}

const fail = (error: unknown): void => {
  const projectError = error instanceof ProjectConflict
  process.stderr.write(
    `error[${projectError ? 'project' : 'benchmark'}]: ${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = projectError ? 3 : 2
}

try {
  cli.parse(process.argv, { run: false })
  if (!cli.matchedCommand) {
    throw new Error(`Unknown command: ${process.argv[2] ?? '<missing>'}.`)
  }
  await cli.runMatchedCommand()
} catch (error) {
  fail(error)
}
