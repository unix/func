import {
  Args,
  ArrayValue,
  Catch,
  Command,
  CommandError,
  CommandMissing,
  DependsOn,
  Enum,
  Exception,
  Exclusive,
  Flag,
  FuncArgs,
  FuncException,
  Handler,
  Required,
  Value,
  ValueValidate,
  run,
} from 'func'

const environments = ['development', 'staging', 'production']
const regions = ['us-east-1', 'eu-west-1', 'ap-southeast-1']
const strategies = ['rolling', 'blue-green', 'canary']
const configFormats = ['json', 'yaml', 'toml']
const configSchemas = ['strict', 'compatible', 'loose']
const platforms = ['linux/amd64', 'linux/arm64', 'darwin/arm64']
const verificationModes = ['none', 'checksum', 'signature']

abstract class FuncCommand {
  @Catch()
  onError(@Exception() exception: FuncException): void {
    fail(exception.error)
  }
}

@Command({
  name: 'release',
  alias: 'r',
  description: 'plan or apply a service release',
})
class ReleaseCommand extends FuncCommand {
  @DependsOn(['confirm'])
  @Value({ description: 'deployment approval ticket' })
  approval?: string

  @Required()
  @ValueValidate(value =>
    typeof value === 'string' && imageReference.test(value)
      ? true
      : 'artifact must be an image tag or sha256 digest reference.',
  )
  @Value({ alias: 'a', description: 'image tag or digest' })
  artifact?: string

  @DependsOn(['strategy'])
  @ValueValidate(value => validateOptionalInteger(value, 'canary-percent', 1, 50))
  @Value({ name: 'canary-percent', type: Number })
  canaryPercent?: number

  @Exclusive(['dry-run'])
  @Flag({ description: 'confirm a release apply' })
  confirm = false

  @Exclusive(['confirm'])
  @Flag({ name: 'dry-run', description: 'validate without applying' })
  dryRun = false

  @Enum(environments)
  @Value({ alias: 'e', description: 'target environment' })
  environment: string = 'staging'

  @Flag({ description: 'write JSON output' })
  json = false

  @Enum(regions)
  @Value({ alias: 'r', description: 'target region' })
  region: string = 'us-east-1'

  @ValueValidate(value => validateInteger(value, 'replicas', 1, 50))
  @Value({ alias: 'n', type: Number, description: 'replica count' })
  replicas = 3

  @ArrayValue({ description: 'deployment variable KEY=value' })
  set: string[] = []

  @Enum(strategies)
  @Value({ alias: 's', description: 'rollout strategy' })
  strategy: string = 'rolling'

  @ArrayValue({ description: 'release tag key=value' })
  tag: string[] = []

  @ValueValidate(value => validateInteger(value, 'timeout', 10, 900))
  @Value({ alias: 't', type: Number, description: 'timeout in seconds' })
  timeout = 300

  @Handler({ path: ['plan'] })
  plan(@Args() args: FuncArgs): void {
    this.execute('plan', args.inputs)
  }

  @Handler({ path: ['apply'] })
  apply(@Args() args: FuncArgs): void {
    this.execute('apply', args.inputs)
  }

  @Handler()
  unknown(@Args() args: FuncArgs): void {
    fail(new Error(`Unknown release action: ${args.inputs[0] ?? '<missing>'}.`))
  }

  private execute(action: 'plan' | 'apply', inputs: string[]): void {
    const service = slug(required(inputs[0], 'service'), 'service')
    const components = uniqueSlugs(inputs.slice(1), 'components', 8)
    if (this.environment === 'production' && !this.artifact?.includes('@sha256:')) {
      throw new Error('production releases require an artifact sha256 digest.')
    }
    if (this.strategy === 'canary' && this.canaryPercent === undefined) {
      throw new Error('--canary-percent is required for the canary strategy.')
    }
    if (this.strategy !== 'canary' && this.canaryPercent !== undefined) {
      throw new Error('--canary-percent is only valid for the canary strategy.')
    }
    if (action === 'plan' && (this.confirm || this.approval)) {
      throw new Error('--confirm and --approval are only valid for release apply.')
    }
    if (action === 'apply' && !this.dryRun && !this.confirm) {
      throw new Error('release apply requires --confirm.')
    }
    if (
      action === 'apply' &&
      this.environment === 'production' &&
      !this.dryRun &&
      (!this.approval || !/^DEP-[0-9]{4,}$/.test(this.approval))
    ) {
      throw new Error('production release apply requires --approval DEP-<number>.')
    }

    output(
      {
        kind: 'release',
        action,
        service,
        components,
        artifact: this.artifact,
        target: { environment: this.environment, region: this.region },
        rollout: {
          strategy: this.strategy,
          replicas: this.replicas,
          timeout: this.timeout,
          canaryPercent: this.canaryPercent ?? null,
        },
        annotations: {
          tags: assignments(this.tag, 'tag', /^[a-z][a-z0-9.-]{0,31}$/, 8),
          settings: assignments(this.set, 'set', /^[A-Z][A-Z0-9_]{0,39}$/, 12),
        },
        safeguards: {
          dryRun: this.dryRun,
          confirmed: this.confirm,
          approval: this.approval ?? null,
        },
      },
      `${action} ${service} -> ${this.environment}/${this.region} (${this.strategy}, ${components.length} components)`,
      this.json,
    )
  }
}

@Command({ name: 'config', alias: 'c', description: 'validate configuration files' })
class ConfigCommand extends FuncCommand {
  @Flag({ name: 'allow-unknown', description: 'allow unknown configuration keys' })
  allowUnknown = false

  @ArrayValue({ name: 'env', description: 'environment value KEY=value' })
  environmentValues: string[] = []

  @Enum(configFormats)
  @Value({ description: 'configuration file format' })
  format: string = 'yaml'

  @Flag({ description: 'write JSON output' })
  json = false

  @ValueValidate(value => validateInteger(value, 'max-warnings', 0, 100))
  @Value({ name: 'max-warnings', type: Number, description: 'warning limit' })
  maxWarnings = 0

  @Enum(configSchemas)
  @Value({ description: 'validation schema mode' })
  schema: string = 'compatible'

  @Handler({ path: ['validate'] })
  validate(@Args() args: FuncArgs): void {
    const profile = oneOf(
      required(args.inputs[0], 'profile'),
      ['local', 'staging', 'production'],
      'profile',
    )
    const files = args.inputs.slice(1)
    validateFiles(files, this.format)
    if (this.schema === 'strict' && this.allowUnknown) {
      throw new Error('--allow-unknown cannot be used with the strict schema.')
    }

    output(
      {
        kind: 'config-validation',
        profile,
        files,
        parser: {
          format: this.format,
          schema: this.schema,
          allowUnknown: this.allowUnknown,
          maxWarnings: this.maxWarnings,
        },
        environment: assignments(
          this.environmentValues,
          'env',
          /^[A-Z][A-Z0-9_]{0,39}$/,
          16,
        ),
      },
      `validate ${files.length} ${this.format} files for ${profile} (${this.schema})`,
      this.json,
    )
  }

  @Handler()
  unknown(@Args() args: FuncArgs): void {
    fail(new Error(`Unknown config action: ${args.inputs[0] ?? '<missing>'}.`))
  }
}

@Command({ name: 'artifact', alias: 'a', description: 'inspect a release artifact' })
class ArtifactCommand extends FuncCommand {
  @Flag({ description: 'write JSON output' })
  json = false

  @DependsOn(['verify'])
  @Value({ description: 'signature key path' })
  key?: string

  @ArrayValue({ description: 'artifact metadata key=value' })
  metadata: string[] = []

  @Enum(platforms)
  @Value({ description: 'artifact platform' })
  platform: string = 'linux/amd64'

  @Enum(verificationModes)
  @Value({ description: 'verification mode' })
  verify: string = 'checksum'

  @Handler({ path: ['inspect'] })
  inspect(@Args() args: FuncArgs): void {
    const reference = required(args.inputs[0], 'reference')
    if (!digestReference.test(reference)) {
      throw new Error('reference must be a registry image with a sha256 digest.')
    }
    if (this.verify === 'signature' && !this.key) {
      throw new Error('--key is required when --verify is signature.')
    }
    if (this.verify !== 'signature' && this.key) {
      throw new Error('--key is only valid when --verify is signature.')
    }

    output(
      {
        kind: 'artifact-inspection',
        reference,
        platform: this.platform,
        verification: { mode: this.verify, key: this.key ?? null },
        metadata: assignments(
          this.metadata,
          'metadata',
          /^[a-z][a-z0-9.-]{0,31}$/,
          12,
        ),
      },
      `inspect ${reference} for ${this.platform} (${this.verify})`,
      this.json,
    )
  }

  @Handler()
  unknown(@Args() args: FuncArgs): void {
    fail(new Error(`Unknown artifact action: ${args.inputs[0] ?? '<missing>'}.`))
  }
}

@CommandMissing()
class MissingCommand {
  @Handler()
  run(@Args() args: FuncArgs): void {
    fail(new Error(`Unknown command: ${args.inputs[0] ?? '<missing>'}.`))
  }
}

@CommandError()
class ErrorCommand {
  constructor(@Exception() exception: FuncException) {
    exception.preventDefaultPrint()
    fail(exception.error)
  }
}

const imageReference =
  /^(?:[a-z0-9.-]+(?::\d+)?\/)?[a-z0-9][a-z0-9._/-]*(?::[A-Za-z0-9._-]+|@sha256:[a-f0-9]{8,})$/
const digestReference = /^[a-z0-9.-]+\/[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{8,}$/

const validateInteger = (
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): true | string => {
  const parsed = Number(value)
  if (Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum) return true
  return `${label} must be an integer between ${minimum} and ${maximum}.`
}

const validateOptionalInteger = (
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): true | string => {
  if (value === undefined) return true
  return validateInteger(value, label, minimum, maximum)
}

const required = (value: string | undefined, label: string): string => {
  if (value) return value
  throw new Error(`${label} is required.`)
}

const oneOf = (value: string, values: string[], label: string): string => {
  if (values.includes(value)) return value
  throw new Error(`${label} must be one of: ${values.join(', ')}.`)
}

const slug = (value: string, label: string): string => {
  if (/^[a-z][a-z0-9-]{1,39}$/.test(value)) return value
  throw new Error(`${label} must be a lowercase slug between 2 and 40 characters.`)
}

const uniqueSlugs = (values: string[], label: string, maximum: number): string[] => {
  if (!values.length) throw new Error(`${label} requires a value.`)
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
  if (!files.length) throw new Error('files requires a value.')
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

const fail = (error: unknown): void => {
  process.stderr.write(
    `error[CLI_ERROR]: ${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = 2
}

await run({
  commands: [
    ReleaseCommand,
    ConfigCommand,
    ArtifactCommand,
    MissingCommand,
    ErrorCommand,
  ],
})
