import {
  Args,
  ArrayString,
  Command,
  Context,
  Enum,
  Exclusive,
  Flag,
  Handler,
  Injectable,
  Module,
  Option,
  OptionCommand,
  Override,
  Required,
  Stdout,
  Value,
  createApp,
} from 'func'
import type { Args as CommandArgs, Exception, OnError } from 'func'
import type { Writable } from 'node:stream'

const profiles = ['local', 'staging', 'production']
const targets = ['development', 'staging', 'production']
const auditFormats = ['summary', 'detailed']
const exportFormats = ['json', 'csv']

@Option()
class AppOptions {
  @Flag({ description: 'write JSON output' })
  json = false

  @Enum(profiles)
  @Value({ alias: 'p', description: 'configuration profile' })
  profile: string = 'local'

  @Flag({ description: 'include trace context' })
  trace = false
}

@Injectable()
class Output {
  constructor(
    readonly options: AppOptions,
    @Stdout() readonly stdout: Writable,
  ) {}

  write(data: object, summary: string) {
    this.stdout.write(`${this.options.json ? JSON.stringify(data) : summary}\n`)
  }
}

@Module({ exports: [Output], providers: [Output] })
class OutputModule {}

@OptionCommand({
  alias: 'C',
  description: 'show invocation context',
  name: 'context',
})
class ContextOption {
  constructor(
    readonly options: AppOptions,
    readonly output: Output,
  ) {}

  @Handler()
  run(@Args() args: CommandArgs) {
    const command = args.invokedPath.join(' ')
    return this.output.write(
      {
        kind: 'context',
        scope: 'app',
        command,
        profile: this.options.profile,
        trace: this.options.trace,
      },
      `context app ${command} (${this.options.profile}, trace ${this.options.trace ? 'on' : 'off'})`,
    )
  }
}

@Command('status')
class StatusCommand {
  constructor(
    readonly options: AppOptions,
    readonly output: Output,
  ) {}

  @Handler()
  run() {
    return this.output.write(
      {
        kind: 'status',
        profile: this.options.profile,
        trace: this.options.trace,
      },
      `status ${this.options.profile} (trace ${this.options.trace ? 'on' : 'off'})`,
    )
  }
}

@Option()
class ProjectOptions {
  @Flag({ name: 'dry-run', description: 'preview changes' })
  dryRun = false

  @Exclusive(['dry-run'])
  @Flag({ description: 'force synchronization' })
  force = false

  @ArrayString({ name: 'label', description: 'project label' })
  labels: string[] = []

  @Required()
  @Value({ description: 'project name' })
  project!: string

  @Enum(targets)
  @Value({ alias: 't', description: 'deployment target' })
  target: string = 'staging'

  snapshot(profile: string) {
    return {
      project: this.project,
      target: this.target,
      labels: this.labels,
      dryRun: this.dryRun,
      profile,
    }
  }
}

class ProjectConflict extends Error {}

@Command('project')
class ProjectCommand {
  @Flag({ description: 'simulate a sync conflict' })
  conflict = false

  constructor(
    readonly app: AppOptions,
    readonly options: ProjectOptions,
    readonly output: Output,
  ) {}

  @Handler('inspect')
  inspect() {
    return this.output.write(
      {
        kind: 'project-inspection',
        ...this.options.snapshot(this.app.profile),
      },
      `inspect ${this.options.project} -> ${this.options.target} (${this.options.labels.length} labels, ${this.app.profile})`,
    )
  }

  @Handler('sync')
  sync() {
    if (this.conflict) {
      throw new ProjectConflict(
        `sync conflict for project "${this.options.project}".`,
      )
    }
    const mode = this.options.dryRun
      ? 'dry-run'
      : this.options.force
        ? 'force'
        : 'safe'
    return this.output.write(
      {
        kind: 'project-sync',
        ...this.options.snapshot(this.app.profile),
        mode,
      },
      `sync ${this.options.project} -> ${this.options.target} (${mode}, ${this.app.profile})`,
    )
  }
}

@Module({
  commands: [ProjectCommand],
  imports: [OutputModule],
  options: [ProjectOptions],
})
class ProjectModule implements OnError {
  onError(exception: Exception, context: Context) {
    if (!(exception.cause instanceof ProjectConflict)) throw exception
    context.io.stderr.write(`error[project]: ${exception.message}\n`)
    context.exitCode = 3
  }
}

@Option()
class AuditOptions {
  @Enum(auditFormats)
  @Value({ description: 'audit output format' })
  format: string = 'summary'

  @Flag({ name: 'include-system', description: 'include system events' })
  includeSystem = false

  @Value({ description: 'maximum audit entries' })
  limit: number = 20

  snapshot(profile: string) {
    return { format: this.format, limit: this.limit, profile }
  }
}

@OptionCommand({
  alias: 'C',
  description: 'show audit invocation context',
  name: 'context',
  overrideAll: true,
})
class AuditContextOption {
  constructor(
    readonly app: AppOptions,
    readonly options: AuditOptions,
    readonly output: Output,
  ) {}

  @Handler()
  run(@Args() args: CommandArgs) {
    const command = args.invokedPath.join(' ')
    return this.output.write(
      {
        kind: 'context',
        scope: 'audit',
        command,
        ...this.options.snapshot(this.app.profile),
      },
      `context audit ${command} (${this.options.format}/${this.options.limit}, ${this.app.profile})`,
    )
  }
}

@Command(['audit', 'list'])
class AuditListCommand {
  constructor(
    readonly app: AppOptions,
    readonly options: AuditOptions,
    readonly output: Output,
  ) {}

  @Handler()
  run() {
    return this.output.write(
      {
        kind: 'audit-list',
        ...this.options.snapshot(this.app.profile),
        includeSystem: this.options.includeSystem,
      },
      `audit list ${this.options.limit} (${this.options.format}, system ${this.options.includeSystem ? 'on' : 'off'}, ${this.app.profile})`,
    )
  }
}

@Command(['audit', 'export'])
class AuditExportCommand {
  @Override()
  @Enum(exportFormats)
  @Value({ description: 'export format' })
  format: string = 'json'

  constructor(
    readonly app: AppOptions,
    readonly options: AuditOptions,
    readonly output: Output,
  ) {}

  @Handler()
  run() {
    return this.output.write(
      {
        kind: 'audit-export',
        format: this.format,
        moduleFormat: this.options.format,
        limit: this.options.limit,
        profile: this.app.profile,
      },
      `audit export ${this.format} (limit ${this.options.limit}, module ${this.options.format})`,
    )
  }
}

@Module({
  commands: [AuditListCommand, AuditExportCommand],
  imports: [OutputModule],
  options: [AuditOptions, AuditContextOption],
})
class AuditModule {}

@Module({
  commands: [StatusCommand],
  imports: [OutputModule, ProjectModule, AuditModule],
  options: [AppOptions, ContextOption],
})
class AppModule implements OnError {
  onError(exception: Exception, context: Context) {
    context.io.stderr.write(`error[benchmark]: ${exception.message}\n`)
    context.exitCode = 2
  }
}

void createApp(AppModule, { appName: 'benchmark-func' }).bootstrap()
