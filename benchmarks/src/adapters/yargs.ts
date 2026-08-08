import yargs, { type Argv, type CommandModule } from 'yargs'
import { hideBin } from 'yargs/helpers'

const environments = ['development', 'staging', 'production'] as const
const regions = ['us-east-1', 'eu-west-1', 'ap-southeast-1'] as const
const actions = ['plan', 'apply'] as const
const strategies = ['rolling', 'blue-green', 'canary'] as const
const profiles = ['local', 'staging', 'production'] as const
const formats = ['json', 'yaml', 'toml'] as const
const schemas = ['strict', 'compatible', 'loose'] as const
const platforms = ['linux/amd64', 'linux/arm64', 'darwin/arm64'] as const
const verificationModes = ['none', 'checksum', 'signature'] as const
const imageReference =
  /^(?:[a-z0-9.-]+(?::\d+)?\/)?[a-z0-9][a-z0-9._/-]*(?::[A-Za-z0-9._-]+|@sha256:[a-f0-9]{8,})$/
const digestReference = /^[a-z0-9.-]+\/[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{8,}$/

type InferBuilderArguments<T extends (command: Argv) => Argv> =
  ReturnType<T> extends Argv<infer Arguments> ? Arguments : never

const releaseBuilder = (command: Argv) =>
  command
    .positional('action', {
      choices: actions,
      demandOption: true,
      type: 'string',
    })
    .positional('service', { demandOption: true, type: 'string' })
    .positional('components', { array: true, type: 'string' })
    .option('artifact', { alias: 'a', demandOption: true, type: 'string' })
    .option('environment', {
      alias: 'e',
      choices: environments,
      default: 'staging',
      type: 'string',
    })
    .option('region', {
      alias: 'r',
      choices: regions,
      default: 'us-east-1',
      type: 'string',
    })
    .option('strategy', {
      alias: 's',
      choices: strategies,
      default: 'rolling',
      type: 'string',
    })
    .option('replicas', { alias: 'n', default: 3, type: 'number' })
    .option('timeout', { alias: 't', default: 300, type: 'number' })
    .option('canary-percent', { type: 'number' })
    .option('tag', { array: true, default: [], type: 'string' })
    .option('set', { array: true, default: [], type: 'string' })
    .option('dry-run', { type: 'boolean' })
    .option('confirm', { type: 'boolean' })
    .option('approval', { type: 'string' })
    .option('json', { default: false, type: 'boolean' })
    .conflicts('confirm', 'dry-run')
    .implies('approval', 'confirm')
    .check(argv => {
      integer(argv.replicas, 'replicas', 1, 50)
      integer(argv.timeout, 'timeout', 10, 900)
      if (argv.canaryPercent !== undefined) {
        integer(argv.canaryPercent, 'canary-percent', 1, 50)
      }
      if (!imageReference.test(argv.artifact)) {
        throw new Error('artifact must be an image tag or sha256 digest reference.')
      }
      if (argv.environment === 'production' && !argv.artifact.includes('@sha256:')) {
        throw new Error('production releases require an artifact sha256 digest.')
      }
      if (argv.strategy === 'canary' && argv.canaryPercent === undefined) {
        throw new Error('--canary-percent is required for the canary strategy.')
      }
      if (argv.strategy !== 'canary' && argv.canaryPercent !== undefined) {
        throw new Error('--canary-percent is only valid for the canary strategy.')
      }
      if (argv.action === 'plan' && (argv.confirm || argv.approval)) {
        throw new Error('--confirm and --approval are only valid for release apply.')
      }
      if (argv.action === 'apply' && !argv.dryRun && !argv.confirm) {
        throw new Error('release apply requires --confirm.')
      }
      if (
        argv.action === 'apply' &&
        argv.environment === 'production' &&
        !argv.dryRun &&
        (!argv.approval || !/^DEP-[0-9]{4,}$/.test(argv.approval))
      ) {
        throw new Error('production release apply requires --approval DEP-<number>.')
      }

      return true
    })

type ReleaseArguments = InferBuilderArguments<typeof releaseBuilder>

const configBuilder = (command: Argv) =>
  command
    .positional('action', {
      choices: ['validate'] as const,
      demandOption: true,
      type: 'string',
    })
    .positional('profile', {
      choices: profiles,
      demandOption: true,
      type: 'string',
    })
    .positional('files', { array: true, demandOption: true, type: 'string' })
    .option('format', { choices: formats, default: 'yaml', type: 'string' })
    .option('schema', {
      choices: schemas,
      default: 'compatible',
      type: 'string',
    })
    .option('env', { array: true, default: [], type: 'string' })
    .option('max-warnings', { default: 0, type: 'number' })
    .option('allow-unknown', { default: false, type: 'boolean' })
    .option('json', { default: false, type: 'boolean' })
    .check(argv => {
      integer(argv.maxWarnings, 'max-warnings', 0, 100)
      validateFiles(argv.files, argv.format)
      if (argv.schema === 'strict' && argv.allowUnknown) {
        throw new Error('--allow-unknown cannot be used with the strict schema.')
      }

      return true
    })

type ConfigArguments = InferBuilderArguments<typeof configBuilder>

const artifactBuilder = (command: Argv) =>
  command
    .positional('action', {
      choices: ['inspect'] as const,
      demandOption: true,
      type: 'string',
    })
    .positional('reference', { demandOption: true, type: 'string' })
    .option('platform', {
      choices: platforms,
      default: 'linux/amd64',
      type: 'string',
    })
    .option('verify', {
      choices: verificationModes,
      default: 'checksum',
      type: 'string',
    })
    .option('key', { type: 'string' })
    .option('metadata', { array: true, default: [], type: 'string' })
    .option('json', { default: false, type: 'boolean' })
    .check(argv => {
      if (!digestReference.test(argv.reference)) {
        throw new Error('reference must be a registry image with a sha256 digest.')
      }
      if (argv.verify === 'signature' && !argv.key) {
        throw new Error('--key is required when --verify is signature.')
      }
      if (argv.verify !== 'signature' && argv.key) {
        throw new Error('--key is only valid when --verify is signature.')
      }

      return true
    })

type ArtifactArguments = InferBuilderArguments<typeof artifactBuilder>

const releaseCommand: CommandModule<object, ReleaseArguments> = {
  aliases: ['r'],
  builder: releaseBuilder,
  command: 'release <action> <service> [components..]',
  describe: 'plan or apply a release',
  handler: argv => {
    const service = slug(argv.service, 'service')
    const components = uniqueSlugs(argv.components ?? [], 'components', 8)
    output(
      {
        kind: 'release',
        action: argv.action,
        service,
        components,
        artifact: argv.artifact,
        target: { environment: argv.environment, region: argv.region },
        rollout: {
          strategy: argv.strategy,
          replicas: argv.replicas,
          timeout: argv.timeout,
          canaryPercent: argv.canaryPercent ?? null,
        },
        annotations: {
          tags: assignments(argv.tag, 'tag', /^[a-z][a-z0-9.-]{0,31}$/, 8),
          settings: assignments(argv.set, 'set', /^[A-Z][A-Z0-9_]{0,39}$/, 12),
        },
        safeguards: {
          dryRun: Boolean(argv.dryRun),
          confirmed: Boolean(argv.confirm),
          approval: argv.approval ?? null,
        },
      },
      `${argv.action} ${service} -> ${argv.environment}/${argv.region} (${argv.strategy}, ${components.length} components)`,
      argv.json,
    )
  },
}

const configCommand: CommandModule<object, ConfigArguments> = {
  aliases: ['c'],
  builder: configBuilder,
  command: 'config <action> <profile> [files..]',
  describe: 'validate configuration files',
  handler: argv => {
    output(
      {
        kind: 'config-validation',
        profile: argv.profile,
        files: argv.files,
        parser: {
          format: argv.format,
          schema: argv.schema,
          allowUnknown: argv.allowUnknown,
          maxWarnings: argv.maxWarnings,
        },
        environment: assignments(argv.env, 'env', /^[A-Z][A-Z0-9_]{0,39}$/, 16),
      },
      `validate ${argv.files.length} ${argv.format} files for ${argv.profile} (${argv.schema})`,
      argv.json,
    )
  },
}

const artifactCommand: CommandModule<object, ArtifactArguments> = {
  aliases: ['a'],
  builder: artifactBuilder,
  command: 'artifact <action> <reference>',
  describe: 'inspect an artifact',
  handler: argv => {
    output(
      {
        kind: 'artifact-inspection',
        reference: argv.reference,
        platform: argv.platform,
        verification: { mode: argv.verify, key: argv.key ?? null },
        metadata: assignments(
          argv.metadata,
          'metadata',
          /^[a-z][a-z0-9.-]{0,31}$/,
          12,
        ),
      },
      `inspect ${argv.reference} for ${argv.platform} (${argv.verify})`,
      argv.json,
    )
  },
}

const parser = yargs(hideBin(process.argv))
  .scriptName('benchmark-yargs')
  .command(releaseCommand)
  .command(configCommand)
  .command(artifactCommand)
  .demandCommand(1)
  .strictCommands()
  .strictOptions()
  .recommendCommands()
  .help()
  .exitProcess(false)
  .fail((message, error: Error | undefined) => {
    throw error ?? new Error(message)
  })

const integer = (
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number => {
  const parsed = Number(value)
  if (Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum)
    return parsed

  throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`)
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

try {
  await parser.parseAsync()
} catch (error) {
  fail(error)
}
