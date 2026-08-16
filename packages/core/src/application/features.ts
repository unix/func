import type { Readable, Writable } from 'node:stream'
import type { CompiledApplication } from './model'

const applicationFeatureBrand = Symbol('applicationFeature')

export interface ApplicationFeature {
  readonly [applicationFeatureBrand]: true
}

export interface BootstrapFeatureContext {
  readonly application: CompiledApplication
  readonly argv: readonly string[]
  readonly cwd: string
  readonly env: Readonly<Record<string, string | undefined>>
  readonly signal: AbortSignal
  readonly stderr: Writable
  readonly stdin: Readable
  readonly stdout: Writable
}

export interface BootstrapFeatureResult {
  readonly exitCode: number
}

export type ApplicationInvocationFeature = (
  context: BootstrapFeatureContext,
  next: (context: BootstrapFeatureContext) => Promise<BootstrapFeatureResult>,
) => Promise<BootstrapFeatureResult>

export interface ApplicationFeatureDefinition {
  readonly bootstrap?: (
    context: BootstrapFeatureContext,
  ) =>
    BootstrapFeatureResult | Promise<BootstrapFeatureResult | undefined> | undefined
  readonly invoke?: ApplicationInvocationFeature
  readonly key: string
}

const featureDefinitions = new WeakMap<
  ApplicationFeature,
  ApplicationFeatureDefinition
>()

class DefinedApplicationFeature implements ApplicationFeature {
  readonly [applicationFeatureBrand] = true as const
}

export const defineApplicationFeature = (
  definition: ApplicationFeatureDefinition,
): ApplicationFeature => {
  const feature = Object.freeze(new DefinedApplicationFeature())
  featureDefinitions.set(feature, Object.freeze({ ...definition }))
  return feature
}

export const resolveApplicationFeatures = (
  input: readonly ApplicationFeature[] | undefined,
): readonly ApplicationFeatureDefinition[] => {
  if (input === undefined) return []
  if (!Array.isArray(input)) {
    throw new TypeError('Application features must be an array.')
  }

  const keys = new Set<string>()
  const definitions = input.map((feature: ApplicationFeature) => {
    const definition = featureDefinitions.get(feature)
    if (!definition) {
      throw new TypeError(
        'Application features must be created by a func feature factory.',
      )
    }
    if (keys.has(definition.key)) {
      throw new TypeError(
        `Application feature "${definition.key}" is registered more than once.`,
      )
    }

    keys.add(definition.key)
    return definition
  })

  return Object.freeze(definitions)
}
