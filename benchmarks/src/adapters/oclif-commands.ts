import { Args, Command, Flags } from '@oclif/core'

const environments = ['development', 'staging', 'production']
const regions = ['us-east-1', 'eu-west-1', 'ap-southeast-1']
const strategies = ['rolling', 'blue-green', 'canary']
const profiles = ['local', 'staging', 'production']
const formats = ['json', 'yaml', 'toml']
const schemas = ['strict', 'compatible', 'loose']
const platforms = ['linux/amd64', 'linux/arm64', 'darwin/arm64']
const verificationModes = ['none', 'checksum', 'signature']
const imageReference =
  /^(?:[a-z0-9.-]+(?::\d+)?\/)?[a-z0-9][a-z0-9._/-]*(?::[A-Za-z0-9._-]+|@sha256:[a-f0-9]{8,})$/
const digestReference = /^[a-z0-9.-]+\/[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{8,}$/

const releaseArgs = {
  service: Args.string({ required: true }),
  components: Args.string({ multiple: true, required: true }),
}

const releaseFlags = {
  artifact: Flags.string({ char: 'a', required: true }),
  environment: Flags.string({
    char: 'e',
    default: 'staging',
    options: environments,
  }),
  region: Flags.string({ char: 'r', default: 'us-east-1', options: regions }),
  strategy: Flags.string({ char: 's', default: 'rolling', options: strategies }),
  replicas: Flags.integer({ char: 'n', default: 3, min: 1, max: 50 }),
  timeout: Flags.integer({ char: 't', default: 300, min: 10, max: 900 }),
  'canary-percent': Flags.integer({ dependsOn: ['strategy'], min: 1, max: 50 }),
  tag: Flags.string({ default: [], multiple: true }),
  set: Flags.string({ default: [], multiple: true }),
  'dry-run': Flags.boolean({ default: false }),
  json: Flags.boolean({ default: false }),
}

class ReleasePlanCommand extends Command {
  static args = releaseArgs
  static flags = releaseFlags
  static summary = 'create a release plan'

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ReleasePlanCommand)
    releaseOutput('plan', args.service, args.components, flags)
  }
}

class ReleaseApplyCommand extends Command {
  static args = releaseArgs
  static flags = {
    ...releaseFlags,
    approval: Flags.string({ dependsOn: ['confirm'] }),
    confirm: Flags.boolean({ default: false, exclusive: ['dry-run'] }),
  }
  static summary = 'apply a release'

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ReleaseApplyCommand)
    releaseOutput('apply', args.service, args.components, flags)
  }
}

class ConfigValidateCommand extends Command {
  static args = {
    profile: Args.string({ options: profiles, required: true }),
    files: Args.string({ multiple: true, required: true }),
  }
  static flags = {
    format: Flags.string({ default: 'yaml', options: formats }),
    schema: Flags.string({ default: 'compatible', options: schemas }),
    env: Flags.string({ default: [], multiple: true }),
    'max-warnings': Flags.integer({ default: 0, min: 0, max: 100 }),
    'allow-unknown': Flags.boolean({ default: false }),
    json: Flags.boolean({ default: false }),
  }
  static summary = 'validate configuration files'

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ConfigValidateCommand)
    validateFiles(args.files, flags.format)
    if (flags.schema === 'strict' && flags['allow-unknown']) {
      throw new Error('--allow-unknown cannot be used with the strict schema.')
    }
    output(
      {
        kind: 'config-validation',
        profile: args.profile,
        files: args.files,
        parser: {
          format: flags.format,
          schema: flags.schema,
          allowUnknown: flags['allow-unknown'],
          maxWarnings: flags['max-warnings'],
        },
        environment: assignments(flags.env, 'env', /^[A-Z][A-Z0-9_]{0,39}$/, 16),
      },
      `validate ${args.files.length} ${flags.format} files for ${args.profile} (${flags.schema})`,
      flags.json,
    )
  }
}

class ArtifactInspectCommand extends Command {
  static args = { reference: Args.string({ required: true }) }
  static flags = {
    platform: Flags.string({ default: 'linux/amd64', options: platforms }),
    verify: Flags.string({ default: 'checksum', options: verificationModes }),
    key: Flags.string({ dependsOn: ['verify'] }),
    metadata: Flags.string({ default: [], multiple: true }),
    json: Flags.boolean({ default: false }),
  }
  static summary = 'inspect an artifact'

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ArtifactInspectCommand)
    if (!digestReference.test(args.reference)) {
      throw new Error('reference must be a registry image with a sha256 digest.')
    }
    if (flags.verify === 'signature' && !flags.key) {
      throw new Error('--key is required when --verify is signature.')
    }
    if (flags.verify !== 'signature' && flags.key) {
      throw new Error('--key is only valid when --verify is signature.')
    }
    output(
      {
        kind: 'artifact-inspection',
        reference: args.reference,
        platform: flags.platform,
        verification: { mode: flags.verify, key: flags.key ?? null },
        metadata: assignments(
          flags.metadata,
          'metadata',
          /^[a-z][a-z0-9.-]{0,31}$/,
          12,
        ),
      },
      `inspect ${args.reference} for ${flags.platform} (${flags.verify})`,
      flags.json,
    )
  }
}

interface ReleaseFlags {
  approval?: string
  artifact: string
  'canary-percent'?: number
  confirm?: boolean
  'dry-run': boolean
  environment: string
  json: boolean
  region: string
  replicas: number
  set: string[]
  strategy: string
  tag: string[]
  timeout: number
}

const releaseOutput = (
  action: 'plan' | 'apply',
  serviceInput: string,
  componentInputs: string[],
  flags: ReleaseFlags,
): void => {
  const service = slug(serviceInput, 'service')
  const components = uniqueSlugs(componentInputs, 'components', 8)
  if (!imageReference.test(flags.artifact)) {
    throw new Error('artifact must be an image tag or sha256 digest reference.')
  }
  if (flags.environment === 'production' && !flags.artifact.includes('@sha256:')) {
    throw new Error('production releases require an artifact sha256 digest.')
  }
  if (flags.strategy === 'canary' && flags['canary-percent'] === undefined) {
    throw new Error('--canary-percent is required for the canary strategy.')
  }
  if (flags.strategy !== 'canary' && flags['canary-percent'] !== undefined) {
    throw new Error('--canary-percent is only valid for the canary strategy.')
  }
  if (action === 'apply' && !flags['dry-run'] && !flags.confirm) {
    throw new Error('release apply requires --confirm.')
  }
  if (
    action === 'apply' &&
    flags.environment === 'production' &&
    !flags['dry-run'] &&
    (!flags.approval || !/^DEP-[0-9]{4,}$/.test(flags.approval))
  ) {
    throw new Error('production release apply requires --approval DEP-<number>.')
  }

  output(
    {
      kind: 'release',
      action,
      service,
      components,
      artifact: flags.artifact,
      target: { environment: flags.environment, region: flags.region },
      rollout: {
        strategy: flags.strategy,
        replicas: flags.replicas,
        timeout: flags.timeout,
        canaryPercent: flags['canary-percent'] ?? null,
      },
      annotations: {
        tags: assignments(flags.tag, 'tag', /^[a-z][a-z0-9.-]{0,31}$/, 8),
        settings: assignments(flags.set, 'set', /^[A-Z][A-Z0-9_]{0,39}$/, 12),
      },
      safeguards: {
        dryRun: flags['dry-run'],
        confirmed: Boolean(flags.confirm),
        approval: flags.approval ?? null,
      },
    },
    `${action} ${service} -> ${flags.environment}/${flags.region} (${flags.strategy}, ${components.length} components)`,
    flags.json,
  )
}

const slug = (value: string, label: string): string => {
  if (/^[a-z][a-z0-9-]{1,39}$/.test(value)) return value

  throw new Error(`${label} must be a lowercase slug between 2 and 40 characters.`)
}

const uniqueSlugs = (values: string[], label: string, maximum: number): string[] => {
  if (values.length > maximum)
    throw new Error(`${label} accepts at most ${maximum} values.`)
  const normalized = values.map(value => slug(value, label))
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${label} values must be unique.`)
  }

  return normalized
}

const assignments = (
  values: string[],
  label: string,
  keyPattern: RegExp,
  maximum: number,
): Record<string, string> => {
  if (values.length > maximum)
    throw new Error(`${label} accepts at most ${maximum} values.`)
  const entries: Record<string, string> = {}
  values.forEach(entry => {
    const separator = entry.indexOf('=')
    const key = separator < 0 ? '' : entry.slice(0, separator)
    const value = separator < 0 ? '' : entry.slice(separator + 1)
    if (!keyPattern.test(key) || !value) {
      throw new Error(`${label} value "${entry}" must use a valid key=value pair.`)
    }
    if (Object.prototype.hasOwnProperty.call(entries, key)) {
      throw new Error(`${label} contains duplicate key "${key}".`)
    }
    entries[key] = value
  })

  return Object.fromEntries(
    Object.entries(entries).sort(([left], [right]) => left.localeCompare(right)),
  )
}

const validateFiles = (files: string[], format: string): void => {
  if (files.length > 10) throw new Error('files accepts at most 10 values.')
  const extensions: Record<string, RegExp> = {
    json: /\.json$/,
    yaml: /\.ya?ml$/,
    toml: /\.toml$/,
  }
  const invalid = files.find(file => !extensions[format].test(file))
  if (invalid)
    throw new Error(`file "${invalid}" does not match the ${format} format.`)
}

const output = (data: object, summary: string, json: boolean): void => {
  process.stdout.write(`${json ? JSON.stringify(data) : summary}\n`)
}

export const COMMANDS = {
  'release:plan': ReleasePlanCommand,
  'release:apply': ReleaseApplyCommand,
  'config:validate': ConfigValidateCommand,
  'artifact:inspect': ArtifactInspectCommand,
  'r:plan': ReleasePlanCommand,
  'r:apply': ReleaseApplyCommand,
  'c:validate': ConfigValidateCommand,
  'a:inspect': ArtifactInspectCommand,
}
