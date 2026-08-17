import { Command, Flags } from '@oclif/core'

const profiles = ['local', 'staging', 'production']
const targets = ['development', 'staging', 'production']
const auditFormats = ['summary', 'detailed']
const exportFormats = ['json', 'csv']

interface AppFlags {
  context: boolean
  json: boolean
  profile: string
  trace: boolean
}

interface AuditFlags extends AppFlags {
  format: string
  'include-system': boolean
  limit: number
}

export class ProjectConflict extends Error {}

const appFlags = {
  profile: Flags.string({
    char: 'p',
    default: 'local',
    options: profiles,
    summary: 'configuration profile',
  }),
  json: Flags.boolean({ default: false, summary: 'write JSON output' }),
  trace: Flags.boolean({ default: false, summary: 'include trace context' }),
  context: Flags.boolean({
    char: 'C',
    default: false,
    summary: 'show invocation context',
  }),
}

const projectFlags = {
  ...appFlags,
  project: Flags.string({ summary: 'project name' }),
  target: Flags.string({
    char: 't',
    default: 'staging',
    options: targets,
    summary: 'deployment target',
  }),
  label: Flags.string({
    default: [],
    multiple: true,
    summary: 'project label',
  }),
  'dry-run': Flags.boolean({ default: false, summary: 'preview changes' }),
  force: Flags.boolean({
    default: false,
    exclusive: ['dry-run'],
    summary: 'force synchronization',
  }),
}

const auditFlags = (formats: string[], defaultFormat: string) => ({
  ...appFlags,
  format: Flags.string({
    default: defaultFormat,
    options: formats,
    summary: 'audit output format',
  }),
  limit: Flags.integer({ default: 20, summary: 'maximum audit entries' }),
  'include-system': Flags.boolean({
    default: false,
    summary: 'include system events',
  }),
})

abstract class BenchmarkCommand extends Command {
  protected output(flags: AppFlags, data: object, summary: string): void {
    this.log(flags.json ? JSON.stringify(data) : summary)
  }

  protected appContext(path: string, flags: AppFlags): boolean {
    if (!flags.context) return false
    this.output(
      flags,
      {
        kind: 'context',
        scope: 'app',
        command: path,
        profile: flags.profile,
        trace: flags.trace,
      },
      `context app ${path} (${flags.profile}, trace ${flags.trace ? 'on' : 'off'})`,
    )
    return true
  }

  protected auditContext(path: string, flags: AuditFlags): boolean {
    if (!flags.context) return false
    this.output(
      flags,
      {
        kind: 'context',
        scope: 'audit',
        command: path,
        profile: flags.profile,
        format: flags.format,
        limit: flags.limit,
      },
      `context audit ${path} (${flags.format}/${flags.limit}, ${flags.profile})`,
    )
    return true
  }

  protected project(value?: string): string {
    if (value) return value
    throw new Error('Option "--project" is required.')
  }
}

class StatusCommand extends BenchmarkCommand {
  static flags = appFlags
  static summary = 'show application status'

  async run(): Promise<void> {
    const { flags } = await this.parse(StatusCommand)
    if (this.appContext('status', flags)) return
    this.output(
      flags,
      { kind: 'status', profile: flags.profile, trace: flags.trace },
      `status ${flags.profile} (trace ${flags.trace ? 'on' : 'off'})`,
    )
  }
}

class ProjectInspectCommand extends BenchmarkCommand {
  static flags = projectFlags
  static summary = 'inspect a project'

  async run(): Promise<void> {
    const { flags } = await this.parse(ProjectInspectCommand)
    if (this.appContext('project inspect', flags)) return
    const project = this.project(flags.project)
    this.output(
      flags,
      {
        kind: 'project-inspection',
        project,
        target: flags.target,
        labels: flags.label,
        dryRun: flags['dry-run'],
        profile: flags.profile,
      },
      `inspect ${project} -> ${flags.target} (${flags.label.length} labels, ${flags.profile})`,
    )
  }
}

class ProjectSyncCommand extends BenchmarkCommand {
  static flags = {
    ...projectFlags,
    conflict: Flags.boolean({
      default: false,
      summary: 'simulate a sync conflict',
    }),
  }
  static summary = 'sync a project'

  async run(): Promise<void> {
    const { flags } = await this.parse(ProjectSyncCommand)
    if (this.appContext('project sync', flags)) return
    const project = this.project(flags.project)
    if (flags.conflict) {
      throw new ProjectConflict(`sync conflict for project "${project}".`)
    }
    const mode = flags['dry-run'] ? 'dry-run' : flags.force ? 'force' : 'safe'
    this.output(
      flags,
      {
        kind: 'project-sync',
        project,
        target: flags.target,
        labels: flags.label,
        mode,
        profile: flags.profile,
      },
      `sync ${project} -> ${flags.target} (${mode}, ${flags.profile})`,
    )
  }
}

class AuditListCommand extends BenchmarkCommand {
  static flags = auditFlags(auditFormats, 'summary')
  static summary = 'list audit events'

  async run(): Promise<void> {
    const { flags } = await this.parse(AuditListCommand)
    if (this.auditContext('audit list', flags)) return
    this.output(
      flags,
      {
        kind: 'audit-list',
        limit: flags.limit,
        format: flags.format,
        includeSystem: flags['include-system'],
        profile: flags.profile,
      },
      `audit list ${flags.limit} (${flags.format}, system ${flags['include-system'] ? 'on' : 'off'}, ${flags.profile})`,
    )
  }
}

class AuditExportCommand extends BenchmarkCommand {
  static flags = auditFlags(exportFormats, 'json')
  static summary = 'export audit events'

  async run(): Promise<void> {
    const { flags } = await this.parse(AuditExportCommand)
    if (
      this.auditContext('audit export', {
        ...flags,
        format: 'summary',
      })
    ) {
      return
    }
    this.output(
      flags,
      {
        kind: 'audit-export',
        format: flags.format,
        moduleFormat: 'summary',
        limit: flags.limit,
        profile: flags.profile,
      },
      `audit export ${flags.format} (limit ${flags.limit}, module summary)`,
    )
  }
}

export const COMMANDS = {
  status: StatusCommand,
  'project:inspect': ProjectInspectCommand,
  'project:sync': ProjectSyncCommand,
  'audit:list': AuditListCommand,
  'audit:export': AuditExportCommand,
}
