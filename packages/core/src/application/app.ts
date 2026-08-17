import { RUNTIME } from '@func/contracts/core-errors'
import { compileApplication } from './compiler'
import type {
  ApplicationFeature,
  ApplicationFeatureDefinition,
  ApplicationInvocationFeature,
  BootstrapFeatureContext,
  BootstrapFeatureResult,
} from './features'
import { resolveApplicationFeatures } from './features'
import { invokeApplication } from './invocation'
import type { CompiledApplication } from './model'
import type { Type } from '../di/types'
import type { Readable, Writable } from 'node:stream'
import type { ApplicationConfiguration } from '../shared/application-configuration'
import { environment } from '../shared/environment'
import type { Environment } from '../shared/environment'
import { ErrorScope, InternalException } from '../shared/errors'

export interface AppOptions extends ApplicationConfiguration {
  features?: readonly ApplicationFeature[]
}

export interface BootstrapOptions {
  argv?: readonly string[]
  cwd?: string
  env?: Environment
  signal?: AbortSignal
  stderr?: Writable
  stdin?: Readable
  stdout?: Writable
}

export interface App {
  bootstrap(options?: BootstrapOptions): Promise<void>
}

class BootstrapApplication implements App {
  private started = false

  constructor(
    private readonly application: CompiledApplication,
    private readonly features: readonly ApplicationFeatureDefinition[],
  ) {}

  async bootstrap(options: BootstrapOptions = {}): Promise<void> {
    if (this.started) {
      throw new InternalException(RUNTIME.APPLICATION_ALREADY_BOOTSTRAPPED, {
        message: 'An application can only be bootstrapped once.',
        scope: ErrorScope.RUNTIME,
      })
    }
    this.started = true
    const context = this.bootstrapContext(options)

    try {
      for (const feature of this.features) {
        const result = await feature.bootstrap?.(context)
        if (!result) continue
        process.exitCode = result.exitCode
        return
      }

      const invocationFeatures = this.features.flatMap(feature =>
        feature.invoke ? [feature.invoke] : [],
      )
      const result = await this.invoke(context, invocationFeatures)
      process.exitCode = result.exitCode
    } catch (error) {
      process.exitCode = 1
      throw error
    }
  }

  private invoke(
    context: BootstrapFeatureContext,
    features: readonly ApplicationInvocationFeature[],
  ): Promise<BootstrapFeatureResult> {
    if (features.length === 0) {
      return invokeApplication(this.application, context.argv, {
        cwd: context.cwd,
        env: context.env,
        signal: context.signal,
        stderr: context.stderr,
        stdin: context.stdin,
        stdout: context.stdout,
      })
    }

    const [feature, ...remainingFeatures] = features
    return feature(context, nextContext =>
      this.invoke(
        Object.freeze({
          ...nextContext,
          env: environment.normalize(nextContext.env),
        }),
        remainingFeatures,
      ),
    )
  }

  private bootstrapContext(options: BootstrapOptions): BootstrapFeatureContext {
    return Object.freeze({
      appName: this.application.appName,
      application: this.application,
      argv: Object.freeze([...(options.argv ?? process.argv.slice(2))]),
      cwd: options.cwd ?? process.cwd(),
      env: environment.normalize(options.env ?? process.env),
      signal: options.signal ?? new AbortController().signal,
      stderr: options.stderr ?? process.stderr,
      stdin: options.stdin ?? process.stdin,
      stdout: options.stdout ?? process.stdout,
    })
  }
}

export const createApp = (input: Type, options: AppOptions = {}): App => {
  const features = resolveApplicationFeatures(options.features)
  return new BootstrapApplication(compileApplication(input, options), features)
}
