import { Command, Option } from 'commander'

const profiles = ['local', 'staging', 'production']
const targets = ['development', 'staging', 'production']
const auditFormats = ['summary', 'detailed']
const exportFormats = ['json', 'csv']

interface AppOptions {
  context: boolean
  json: boolean
  profile: string
  trace: boolean
}

interface ProjectOptions extends AppOptions {
  dryRun: boolean
  force: boolean
  label: string[]
  project?: string
  target: string
}

interface AuditOptions extends AppOptions {
  format: string
  includeSystem: boolean
  limit: number
}

class ProjectConflict extends Error {}

const collect = (value: string, previous: string[]): string[] =>
  previous.concat(value)

const integer = (value: string): number => {
  const parsed = Number(value)
  if (Number.isInteger(parsed)) return parsed
  throw new Error('limit must be an integer.')
}

const output = (options: AppOptions, data: object, summary: string): void => {
  process.stdout.write(`${options.json ? JSON.stringify(data) : summary}\n`)
}

const commandPath = (command: Command): string => {
  const names: string[] = []
  let current = command
  while (current.parent) {
    names.unshift(current.name())
    current = current.parent
  }
  return names.join(' ')
}

const handleContext = (
  command: Command,
  options: AppOptions | AuditOptions,
  scope: 'app' | 'audit' = 'app',
): boolean => {
  if (!options.context) return false
  const path = commandPath(command)
  if (scope === 'audit') {
    const audit = options as AuditOptions
    output(
      audit,
      {
        kind: 'context',
        scope,
        command: path,
        profile: audit.profile,
        format: audit.format,
        limit: audit.limit,
      },
      `context audit ${path} (${audit.format}/${audit.limit}, ${audit.profile})`,
    )
    return true
  }
  output(
    options,
    {
      kind: 'context',
      scope,
      command: path,
      profile: options.profile,
      trace: options.trace,
    },
    `context app ${path} (${options.profile}, trace ${options.trace ? 'on' : 'off'})`,
  )
  return true
}

const requiredProject = (options: ProjectOptions): string => {
  if (options.project) return options.project
  throw new Error('Option "--project" is required.')
}

const addProjectOptions = (command: Command): Command =>
  command
    .option('--project <name>', 'project name')
    .addOption(
      new Option('-t, --target <target>', 'deployment target')
        .choices(targets)
        .default('staging'),
    )
    .option('--label <label>', 'project label', collect, [])
    .option('--dry-run', 'preview changes', false)
    .addOption(
      new Option('--force', 'force synchronization')
        .conflicts('dryRun')
        .default(false),
    )

const addAuditOptions = (
  command: Command,
  formats: string[],
  defaultFormat: string,
): Command =>
  command
    .addOption(
      new Option('--format <format>', 'audit output format')
        .choices(formats)
        .default(defaultFormat),
    )
    .option('--limit <count>', 'maximum audit entries', integer, 20)
    .option('--include-system', 'include system events', false)

const program = new Command()
  .name('benchmark-commander')
  .description('module scope comparison workload')
  .showSuggestionAfterError()
  .exitOverride()
  .addOption(
    new Option('-p, --profile <profile>', 'configuration profile')
      .choices(profiles)
      .default('local'),
  )
  .option('--json', 'write JSON output', false)
  .option('--trace', 'include trace context', false)
  .option('-C, --context', 'show invocation context', false)

program
  .command('status')
  .description('show application status')
  .action((_, command: Command) => {
    const options = command.optsWithGlobals() as AppOptions
    if (handleContext(command, options)) return
    output(
      options,
      { kind: 'status', profile: options.profile, trace: options.trace },
      `status ${options.profile} (trace ${options.trace ? 'on' : 'off'})`,
    )
  })

const project = program.command('project').description('inspect and sync projects')

addProjectOptions(
  project.command('inspect').description('inspect a project'),
).action((options: ProjectOptions, command: Command) => {
  const merged = { ...command.optsWithGlobals(), ...options } as ProjectOptions
  if (handleContext(command, merged)) return
  const name = requiredProject(merged)
  output(
    merged,
    {
      kind: 'project-inspection',
      project: name,
      target: merged.target,
      labels: merged.label,
      dryRun: merged.dryRun,
      profile: merged.profile,
    },
    `inspect ${name} -> ${merged.target} (${merged.label.length} labels, ${merged.profile})`,
  )
})

addProjectOptions(project.command('sync').description('sync a project'))
  .option('--conflict', 'simulate a sync conflict', false)
  .action((options: ProjectOptions & { conflict: boolean }, command: Command) => {
    const merged = { ...command.optsWithGlobals(), ...options } as ProjectOptions & {
      conflict: boolean
    }
    if (handleContext(command, merged)) return
    const name = requiredProject(merged)
    if (merged.conflict) {
      throw new ProjectConflict(`sync conflict for project "${name}".`)
    }
    const mode = merged.dryRun ? 'dry-run' : merged.force ? 'force' : 'safe'
    output(
      merged,
      {
        kind: 'project-sync',
        project: name,
        target: merged.target,
        labels: merged.label,
        mode,
        profile: merged.profile,
      },
      `sync ${name} -> ${merged.target} (${mode}, ${merged.profile})`,
    )
  })

const audit = program.command('audit').description('query and export audit events')

addAuditOptions(
  audit.command('list').description('list audit events'),
  auditFormats,
  'summary',
).action((options: AuditOptions, command: Command) => {
  const merged = { ...command.optsWithGlobals(), ...options } as AuditOptions
  if (handleContext(command, merged, 'audit')) return
  output(
    merged,
    {
      kind: 'audit-list',
      limit: merged.limit,
      format: merged.format,
      includeSystem: merged.includeSystem,
      profile: merged.profile,
    },
    `audit list ${merged.limit} (${merged.format}, system ${merged.includeSystem ? 'on' : 'off'}, ${merged.profile})`,
  )
})

addAuditOptions(
  audit.command('export').description('export audit events'),
  exportFormats,
  'json',
).action((options: AuditOptions, command: Command) => {
  const merged = { ...command.optsWithGlobals(), ...options } as AuditOptions
  if (handleContext(command, { ...merged, format: 'summary' }, 'audit')) return
  output(
    merged,
    {
      kind: 'audit-export',
      format: merged.format,
      moduleFormat: 'summary',
      limit: merged.limit,
      profile: merged.profile,
    },
    `audit export ${merged.format} (limit ${merged.limit}, module summary)`,
  )
})

const fail = (error: unknown): void => {
  const projectError = error instanceof ProjectConflict
  process.stderr.write(
    `error[${projectError ? 'project' : 'benchmark'}]: ${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = projectError ? 3 : 2
}

await program.parseAsync(process.argv).catch(fail)
