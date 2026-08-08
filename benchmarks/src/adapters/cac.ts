import { cac } from 'cac'

const environments = ['development', 'staging', 'production']
const regions = ['us-east-1', 'eu-west-1', 'ap-southeast-1']
const actions = ['plan', 'apply']
const strategies = ['rolling', 'blue-green', 'canary']
const profiles = ['local', 'staging', 'production']
const formats = ['json', 'yaml', 'toml']
const schemas = ['strict', 'compatible', 'loose']
const platforms = ['linux/amd64', 'linux/arm64', 'darwin/arm64']
const verificationModes = ['none', 'checksum', 'signature']
const imageReference =
  /^(?:[a-z0-9.-]+(?::\d+)?\/)?[a-z0-9][a-z0-9._/-]*(?::[A-Za-z0-9._-]+|@sha256:[a-f0-9]{8,})$/
const digestReference = /^[a-z0-9.-]+\/[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{8,}$/

const cli = cac('benchmark-cac')

cli
  .command('release <action> <service> [...components]', 'plan or apply a release')
  .alias('r')
  .option('-a, --artifact <reference>', 'image tag or digest')
  .option('-e, --environment <environment>', 'target environment', {
    default: 'staging',
  })
  .option('-r, --region <region>', 'target region', { default: 'us-east-1' })
  .option('-s, --strategy <strategy>', 'rollout strategy', { default: 'rolling' })
  .option('-n, --replicas <count>', 'replica count', { default: 3 })
  .option('-t, --timeout <seconds>', 'timeout in seconds', { default: 300 })
  .option('--canary-percent <percent>', 'canary traffic percentage')
  .option('--tag <key=value>', 'release tag')
  .option('--set <KEY=value>', 'deployment variable')
  .option('--dry-run', 'validate without applying')
  .option('--confirm', 'confirm release apply')
  .option('--approval <ticket>', 'approval ticket')
  .option('--json', 'write JSON output')
  .action(
    (
      actionInput: string,
      serviceInput: string,
      componentInputs: string[],
      options: Record<string, unknown>,
    ) => {
      runSafely(() => {
        const action = oneOf(actionInput, actions, 'action')
        const service = slug(serviceInput, 'service')
        const components = uniqueSlugs(componentInputs, 'components', 8)
        const artifact = required(options.artifact, 'artifact')
        const environment = oneOf(options.environment, environments, 'environment')
        const region = oneOf(options.region, regions, 'region')
        const strategy = oneOf(options.strategy, strategies, 'strategy')
        const replicas = integer(options.replicas, 'replicas', 1, 50)
        const timeout = integer(options.timeout, 'timeout', 10, 900)
        const canaryPercent = optionalInteger(
          options.canaryPercent,
          'canary-percent',
          1,
          50,
        )
        const dryRun = Boolean(options.dryRun)
        const confirm = Boolean(options.confirm)
        const approval =
          options.approval === undefined ? undefined : String(options.approval)

        if (!imageReference.test(artifact)) {
          throw new Error(
            'artifact must be an image tag or sha256 digest reference.',
          )
        }
        if (environment === 'production' && !artifact.includes('@sha256:')) {
          throw new Error('production releases require an artifact sha256 digest.')
        }
        if (strategy === 'canary' && canaryPercent === undefined) {
          throw new Error('--canary-percent is required for the canary strategy.')
        }
        if (strategy !== 'canary' && canaryPercent !== undefined) {
          throw new Error('--canary-percent is only valid for the canary strategy.')
        }
        if (action === 'plan' && (confirm || approval)) {
          throw new Error(
            '--confirm and --approval are only valid for release apply.',
          )
        }
        if (action === 'apply' && dryRun && confirm) {
          throw new Error('--dry-run and --confirm cannot be used together.')
        }
        if (action === 'apply' && !dryRun && !confirm) {
          throw new Error('release apply requires --confirm.')
        }
        if (
          action === 'apply' &&
          environment === 'production' &&
          !dryRun &&
          (!approval || !/^DEP-[0-9]{4,}$/.test(approval))
        ) {
          throw new Error(
            'production release apply requires --approval DEP-<number>.',
          )
        }

        output(
          {
            kind: 'release',
            action,
            service,
            components,
            artifact,
            target: { environment, region },
            rollout: {
              strategy,
              replicas,
              timeout,
              canaryPercent: canaryPercent ?? null,
            },
            annotations: {
              tags: assignments(
                list(options.tag),
                'tag',
                /^[a-z][a-z0-9.-]{0,31}$/,
                8,
              ),
              settings: assignments(
                list(options.set),
                'set',
                /^[A-Z][A-Z0-9_]{0,39}$/,
                12,
              ),
            },
            safeguards: { dryRun, confirmed: confirm, approval: approval ?? null },
          },
          `${action} ${service} -> ${environment}/${region} (${strategy}, ${components.length} components)`,
          Boolean(options.json),
        )
      })
    },
  )

cli
  .command('config <action> <profile> [...files]', 'validate configuration files')
  .alias('c')
  .option('--format <format>', 'configuration file format', { default: 'yaml' })
  .option('--schema <schema>', 'validation schema mode', { default: 'compatible' })
  .option('--env <KEY=value>', 'environment value')
  .option('--max-warnings <count>', 'warning limit', { default: 0 })
  .option('--allow-unknown', 'allow unknown configuration keys')
  .option('--json', 'write JSON output')
  .action(
    (
      actionInput: string,
      profileInput: string,
      fileInputs: string[],
      options: Record<string, unknown>,
    ) => {
      runSafely(() => {
        oneOf(actionInput, ['validate'], 'action')
        const profile = oneOf(profileInput, profiles, 'profile')
        const format = oneOf(options.format, formats, 'format')
        const schema = oneOf(options.schema, schemas, 'schema')
        const maxWarnings = integer(options.maxWarnings, 'max-warnings', 0, 100)
        const files = list(fileInputs)
        validateFiles(files, format)
        const allowUnknown = Boolean(options.allowUnknown)
        if (schema === 'strict' && allowUnknown) {
          throw new Error('--allow-unknown cannot be used with the strict schema.')
        }
        output(
          {
            kind: 'config-validation',
            profile,
            files,
            parser: { format, schema, allowUnknown, maxWarnings },
            environment: assignments(
              list(options.env),
              'env',
              /^[A-Z][A-Z0-9_]{0,39}$/,
              16,
            ),
          },
          `validate ${files.length} ${format} files for ${profile} (${schema})`,
          Boolean(options.json),
        )
      })
    },
  )

cli
  .command('artifact <action> <reference>', 'inspect an artifact')
  .alias('a')
  .option('--platform <platform>', 'artifact platform', { default: 'linux/amd64' })
  .option('--verify <mode>', 'verification mode', { default: 'checksum' })
  .option('--key <path>', 'signature key path')
  .option('--metadata <key=value>', 'artifact metadata')
  .option('--json', 'write JSON output')
  .action(
    (
      actionInput: string,
      referenceInput: string,
      options: Record<string, unknown>,
    ) => {
      runSafely(() => {
        oneOf(actionInput, ['inspect'], 'action')
        const reference = required(referenceInput, 'reference')
        const platform = oneOf(options.platform, platforms, 'platform')
        const verify = oneOf(options.verify, verificationModes, 'verify')
        const key = options.key === undefined ? undefined : String(options.key)
        if (!digestReference.test(reference)) {
          throw new Error('reference must be a registry image with a sha256 digest.')
        }
        if (verify === 'signature' && !key) {
          throw new Error('--key is required when --verify is signature.')
        }
        if (verify !== 'signature' && key) {
          throw new Error('--key is only valid when --verify is signature.')
        }
        output(
          {
            kind: 'artifact-inspection',
            reference,
            platform,
            verification: { mode: verify, key: key ?? null },
            metadata: assignments(
              list(options.metadata),
              'metadata',
              /^[a-z][a-z0-9.-]{0,31}$/,
              12,
            ),
          },
          `inspect ${reference} for ${platform} (${verify})`,
          Boolean(options.json),
        )
      })
    },
  )

cli.help()
cli.version('1.0.0')

const runSafely = (action: () => void): void => {
  try {
    action()
  } catch (error) {
    fail(error)
  }
}

const required = (value: unknown, label: string): string => {
  if (typeof value === 'string' && value) return value
  throw new Error(`${label} is required.`)
}

const oneOf = (value: unknown, values: string[], label: string): string => {
  if (typeof value === 'string' && values.includes(value)) return value
  throw new Error(`${label} must be one of: ${values.join(', ')}.`)
}

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

const optionalInteger = (
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number | undefined => {
  if (value === undefined) return undefined
  return integer(value, label, minimum, maximum)
}

const list = (value: unknown): string[] => {
  if (value === undefined) return []
  if (Array.isArray(value)) return value.map(String)
  return [String(value)]
}

const slug = (value: string, label: string): string => {
  if (/^[a-z][a-z0-9-]{1,39}$/.test(value)) return value
  throw new Error(`${label} must be a lowercase slug between 2 and 40 characters.`)
}

const uniqueSlugs = (values: string[], label: string, maximum: number): string[] => {
  const normalized = list(values).map(value => slug(value, label))
  if (!normalized.length) throw new Error(`${label} requires a value.`)
  if (normalized.length > maximum)
    throw new Error(`${label} accepts at most ${maximum} values.`)
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

try {
  cli.parse(process.argv, { run: false })
  if (!cli.matchedCommand)
    throw new Error(`Unknown command: ${process.argv[2] ?? '<missing>'}.`)
  await cli.runMatchedCommand()
} catch (error) {
  fail(error)
}
