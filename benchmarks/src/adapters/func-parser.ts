import { createParser } from 'func/parser'

const profiles = ['local', 'staging', 'production'] as const
const targets = ['development', 'staging', 'production'] as const
const auditFormats = ['summary', 'detailed'] as const
const exportFormats = ['json', 'csv'] as const

const appOptions = {
  context: { type: Boolean, alias: 'C' },
  json: Boolean,
  profile: { type: String, alias: 'p' },
  trace: Boolean,
} as const

const rootParser = createParser({
  options: appOptions,
  commands: {
    audit: { passthrough: true },
    project: { passthrough: true },
    status: {},
  },
})

const projectParser = createParser({
  options: {
    ...appOptions,
    dryRun: { type: Boolean, name: 'dry-run' },
    force: Boolean,
    label: { type: String, multiple: true },
    project: String,
    target: { type: String, alias: 't' },
  },
  commands: {
    inspect: {},
    sync: { options: { conflict: Boolean } },
  },
})

const auditParser = createParser({
  options: {
    ...appOptions,
    format: String,
    includeSystem: { type: Boolean, name: 'include-system' },
    limit: Number,
  },
  commands: {
    export: {},
    list: {},
  },
})

interface AppInvocation {
  options: {
    context: boolean
    json: boolean
    profile: string | undefined
    trace: boolean
  }
  supplied: {
    has(value: 'context' | 'json' | 'profile' | 'trace'): boolean
  }
}

interface AppValues {
  context: boolean
  json: boolean
  profile: string
  trace: boolean
}

class ProjectConflict extends Error {}

const mergeApp = (root: AppInvocation, local: AppInvocation = root): AppValues => ({
  context: local.supplied.has('context')
    ? local.options.context
    : root.options.context,
  json: local.supplied.has('json') ? local.options.json : root.options.json,
  profile: oneOf(
    local.supplied.has('profile')
      ? local.options.profile
      : (root.options.profile ?? 'local'),
    profiles,
    'profile',
  ),
  trace: local.supplied.has('trace') ? local.options.trace : root.options.trace,
})

const oneOf = <const Values extends readonly string[]>(
  value: string | undefined,
  values: Values,
  label: string,
): Values[number] => {
  if (value !== undefined && values.some(option => option === value)) return value
  throw new Error(`${label} must be one of: ${values.join(', ')}.`)
}

const required = (value: string | undefined, label: string): string => {
  if (value) return value
  throw new Error(`Option "--${label}" is required.`)
}

const integer = (value: number | undefined, label: string, fallback: number) => {
  const result = value ?? fallback
  if (Number.isInteger(result)) return result
  throw new Error(`${label} must be an integer.`)
}

const output = (options: AppValues, data: object, summary: string): void => {
  process.stdout.write(`${options.json ? JSON.stringify(data) : summary}\n`)
}

const appContext = (command: string, options: AppValues): boolean => {
  if (!options.context) return false
  output(
    options,
    {
      kind: 'context',
      scope: 'app',
      command,
      profile: options.profile,
      trace: options.trace,
    },
    `context app ${command} (${options.profile}, trace ${options.trace ? 'on' : 'off'})`,
  )
  return true
}

const auditContext = (
  command: string,
  options: AppValues,
  format: string,
  limit: number,
): boolean => {
  if (!options.context) return false
  output(
    options,
    {
      kind: 'context',
      scope: 'audit',
      command,
      profile: options.profile,
      format,
      limit,
    },
    `context audit ${command} (${format}/${limit}, ${options.profile})`,
  )
  return true
}

try {
  const root = rootParser.parse(process.argv.slice(2))
  if (root.command === 'status') {
    const app = mergeApp(root)
    if (!appContext('status', app)) {
      output(
        app,
        { kind: 'status', profile: app.profile, trace: app.trace },
        `status ${app.profile} (trace ${app.trace ? 'on' : 'off'})`,
      )
    }
  }

  if (root.command === 'project') {
    const command = projectParser.parse(root.inputs)
    if (!command.command) throw new Error('Unknown project command.')
    const app = mergeApp(root, command)
    const path = `project ${command.command}`
    if (!appContext(path, app)) {
      const project = required(command.options.project, 'project')
      const target = oneOf(command.options.target ?? 'staging', targets, 'target')
      const labels = command.options.label
      const dryRun = command.options.dryRun
      const force = command.options.force
      if (dryRun && force) {
        throw new Error('--force cannot be used with --dry-run.')
      }
      if (command.command === 'inspect') {
        output(
          app,
          {
            kind: 'project-inspection',
            project,
            target,
            labels,
            dryRun,
            profile: app.profile,
          },
          `inspect ${project} -> ${target} (${labels.length} labels, ${app.profile})`,
        )
      }
      if (command.command === 'sync') {
        if (command.options.conflict) {
          throw new ProjectConflict(`sync conflict for project "${project}".`)
        }
        const mode = dryRun ? 'dry-run' : force ? 'force' : 'safe'
        output(
          app,
          {
            kind: 'project-sync',
            project,
            target,
            labels,
            mode,
            profile: app.profile,
          },
          `sync ${project} -> ${target} (${mode}, ${app.profile})`,
        )
      }
    }
  }

  if (root.command === 'audit') {
    const command = auditParser.parse(root.inputs)
    if (!command.command) throw new Error('Unknown audit command.')
    const app = mergeApp(root, command)
    const moduleFormat = 'summary'
    const formats = command.command === 'export' ? exportFormats : auditFormats
    const format = oneOf(
      command.options.format ??
        (command.command === 'export' ? 'json' : moduleFormat),
      formats,
      'format',
    )
    const limit = integer(command.options.limit, 'limit', 20)
    const path = `audit ${command.command}`
    if (
      !auditContext(
        path,
        app,
        command.command === 'export' ? moduleFormat : format,
        limit,
      )
    ) {
      if (command.command === 'list') {
        output(
          app,
          {
            kind: 'audit-list',
            limit,
            format,
            includeSystem: command.options.includeSystem,
            profile: app.profile,
          },
          `audit list ${limit} (${format}, system ${command.options.includeSystem ? 'on' : 'off'}, ${app.profile})`,
        )
      }
      if (command.command === 'export') {
        output(
          app,
          {
            kind: 'audit-export',
            format,
            moduleFormat,
            limit,
            profile: app.profile,
          },
          `audit export ${format} (limit ${limit}, module ${moduleFormat})`,
        )
      }
    }
  }
} catch (error) {
  const projectError = error instanceof ProjectConflict
  process.stderr.write(
    `error[${projectError ? 'project' : 'benchmark'}]: ${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = projectError ? 3 : 2
}
