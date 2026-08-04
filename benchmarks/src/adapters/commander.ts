import {
  Argument,
  Command,
  CommanderError,
  InvalidArgumentError,
  Option,
} from 'commander'

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

interface ReleaseOptions {
  approval?: string
  artifact: string
  canaryPercent?: number
  confirm?: boolean
  dryRun?: boolean
  environment: string
  json?: boolean
  region: string
  replicas: number
  set: string[]
  strategy: string
  tag: string[]
  timeout: number
}

interface ConfigOptions {
  allowUnknown?: boolean
  env: string[]
  format: string
  json?: boolean
  maxWarnings: number
  schema: string
}

interface ArtifactOptions {
  json?: boolean
  key?: string
  metadata: string[]
  platform: string
  verify: string
}

const collect = (value: string, previous: string[] = []): string[] =>
  previous.concat(value)

const integer =
  (label: string, minimum: number, maximum: number) =>
  (value: string): number => {
    const parsed = Number(value)
    if (Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum)
      return parsed

    throw new InvalidArgumentError(
      `${label} must be an integer between ${minimum} and ${maximum}.`,
    )
  }

const executeSafely = (action: () => void): void => {
  try {
    action()
  } catch (error) {
    fail(error)
  }
}

const program = new Command()
  .name('benchmark-commander')
  .description('CLI framework comparison workload')
  .showSuggestionAfterError()
  .exitOverride()

const release = program
  .command('release')
  .alias('r')
  .description('plan or apply a release')

const addReleaseOptions = (command: Command, action: 'plan' | 'apply'): Command => {
  command
    .requiredOption('-a, --artifact <reference>', 'image tag or digest')
    .addOption(
      new Option('-e, --environment <environment>', 'target environment')
        .choices(environments)
        .default('staging'),
    )
    .addOption(
      new Option('-r, --region <region>', 'target region')
        .choices(regions)
        .default('us-east-1'),
    )
    .addOption(
      new Option('-s, --strategy <strategy>', 'rollout strategy')
        .choices(strategies)
        .default('rolling'),
    )
    .addOption(
      new Option('-n, --replicas <count>', 'replica count')
        .argParser(integer('replicas', 1, 50))
        .default(3),
    )
    .addOption(
      new Option('-t, --timeout <seconds>', 'timeout in seconds')
        .argParser(integer('timeout', 10, 900))
        .default(300),
    )
    .addOption(
      new Option(
        '--canary-percent <percent>',
        'canary traffic percentage',
      ).argParser(integer('canary-percent', 1, 50)),
    )
    .addOption(
      new Option('--tag <key=value>', 'release tag').argParser(collect).default([]),
    )
    .addOption(
      new Option('--set <KEY=value>', 'deployment variable')
        .argParser(collect)
        .default([]),
    )
    .option('--dry-run', 'validate without applying')
    .option('--json', 'write JSON output')

  if (action === 'apply') {
    command
      .addOption(
        new Option('--confirm', 'confirm release apply').conflicts('dryRun'),
      )
      .option('--approval <ticket>', 'approval ticket')
  }

  return command
}

addReleaseOptions(
  release
    .command('plan <service> [components...]')
    .description('create a release plan'),
  'plan',
).action((service: string, components: string[], options: ReleaseOptions) => {
  executeSafely(() => executeRelease('plan', service, components, options))
})

addReleaseOptions(
  release.command('apply <service> [components...]').description('apply a release'),
  'apply',
).action((service: string, components: string[], options: ReleaseOptions) => {
  executeSafely(() => executeRelease('apply', service, components, options))
})

const config = program
  .command('config')
  .alias('c')
  .description('validate configuration files')
config
  .command('validate')
  .description('validate configuration files')
  .addArgument(new Argument('<profile>').choices(profiles))
  .addArgument(new Argument('<files...>'))
  .addOption(new Option('--format <format>').choices(formats).default('yaml'))
  .addOption(new Option('--schema <schema>').choices(schemas).default('compatible'))
  .addOption(new Option('--env <KEY=value>').argParser(collect).default([]))
  .addOption(
    new Option('--max-warnings <count>')
      .argParser(integer('max-warnings', 0, 100))
      .default(0),
  )
  .option('--allow-unknown')
  .option('--json')
  .action((profile: string, files: string[], options: ConfigOptions) => {
    executeSafely(() => {
      validateFiles(files, options.format)
      if (options.schema === 'strict' && options.allowUnknown) {
        throw new Error('--allow-unknown cannot be used with the strict schema.')
      }
      const environment = assignments(
        options.env,
        'env',
        /^[A-Z][A-Z0-9_]{0,39}$/,
        16,
      )
      output(
        {
          kind: 'config-validation',
          profile,
          files,
          parser: {
            format: options.format,
            schema: options.schema,
            allowUnknown: Boolean(options.allowUnknown),
            maxWarnings: options.maxWarnings,
          },
          environment,
        },
        `validate ${files.length} ${options.format} files for ${profile} (${options.schema})`,
        Boolean(options.json),
      )
    })
  })

const artifact = program
  .command('artifact')
  .alias('a')
  .description('inspect an artifact')
artifact
  .command('inspect <reference>')
  .description('inspect an artifact')
  .addOption(
    new Option('--platform <platform>').choices(platforms).default('linux/amd64'),
  )
  .addOption(
    new Option('--verify <mode>').choices(verificationModes).default('checksum'),
  )
  .option('--key <path>')
  .addOption(new Option('--metadata <key=value>').argParser(collect).default([]))
  .option('--json')
  .action((reference: string, options: ArtifactOptions) => {
    executeSafely(() => {
      if (!digestReference.test(reference)) {
        throw new Error('reference must be a registry image with a sha256 digest.')
      }
      if (options.verify === 'signature' && !options.key) {
        throw new Error('--key is required when --verify is signature.')
      }
      if (options.verify !== 'signature' && options.key) {
        throw new Error('--key is only valid when --verify is signature.')
      }
      output(
        {
          kind: 'artifact-inspection',
          reference,
          platform: options.platform,
          verification: { mode: options.verify, key: options.key ?? null },
          metadata: assignments(
            options.metadata,
            'metadata',
            /^[a-z][a-z0-9.-]{0,31}$/,
            12,
          ),
        },
        `inspect ${reference} for ${options.platform} (${options.verify})`,
        Boolean(options.json),
      )
    })
  })

const executeRelease = (
  action: 'plan' | 'apply',
  serviceInput: string,
  componentInputs: string[],
  options: ReleaseOptions,
): void => {
  const service = slug(serviceInput, 'service')
  const components = uniqueSlugs(componentInputs, 'components', 8)
  if (!imageReference.test(options.artifact)) {
    throw new Error('artifact must be an image tag or sha256 digest reference.')
  }
  if (
    options.environment === 'production' &&
    !options.artifact.includes('@sha256:')
  ) {
    throw new Error('production releases require an artifact sha256 digest.')
  }
  if (options.strategy === 'canary' && options.canaryPercent === undefined) {
    throw new Error('--canary-percent is required for the canary strategy.')
  }
  if (options.strategy !== 'canary' && options.canaryPercent !== undefined) {
    throw new Error('--canary-percent is only valid for the canary strategy.')
  }
  if (action === 'apply' && !options.dryRun && !options.confirm) {
    throw new Error('release apply requires --confirm.')
  }
  if (
    action === 'apply' &&
    options.environment === 'production' &&
    !options.dryRun &&
    (!options.approval || !/^DEP-[0-9]{4,}$/.test(options.approval))
  ) {
    throw new Error('production release apply requires --approval DEP-<number>.')
  }

  output(
    {
      kind: 'release',
      action,
      service,
      components,
      artifact: options.artifact,
      target: { environment: options.environment, region: options.region },
      rollout: {
        strategy: options.strategy,
        replicas: options.replicas,
        timeout: options.timeout,
        canaryPercent: options.canaryPercent ?? null,
      },
      annotations: {
        tags: assignments(options.tag, 'tag', /^[a-z][a-z0-9.-]{0,31}$/, 8),
        settings: assignments(options.set, 'set', /^[A-Z][A-Z0-9_]{0,39}$/, 12),
      },
      safeguards: {
        dryRun: Boolean(options.dryRun),
        confirmed: Boolean(options.confirm),
        approval: options.approval ?? null,
      },
    },
    `${action} ${service} -> ${options.environment}/${options.region} (${options.strategy}, ${components.length} components)`,
    Boolean(options.json),
  )
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
  await program.parseAsync(process.argv)
} catch (error) {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode
  } else {
    fail(error)
  }
}
