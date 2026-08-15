import { RUNTIME } from '@func/shared/core-errors'
import type { Readable, Writable } from 'node:stream'
import type { CompiledApplication } from '../application/module-compiler'
import {
  Context,
  ExceptionContext,
  failContext,
  selectContextCommand,
  selectContextInvocation,
} from '../context'
import type { CompiledModule } from '../di/compiler'
import { RuntimeInjector } from '../di/injector'
import { hasOnDispose, hasOnError, hasOnInit } from '../di/lifecycle'
import type { ExecutionOutcome } from '../di/lifecycle'
import type { ProviderToken, Type } from '../di/provider'
import { ARGS } from '../injection'
import type {
  Args as CommandArgs,
  ArgsOptionValue,
  Deprecation,
  UserOption,
} from '../interfaces'
import { bindFieldOptions, hydrateFieldOptions } from '../options/field-binding'
import type { Exception } from '../shared/errors'
import {
  ErrorScope,
  InternalException,
  isException,
  printException,
} from '../shared/errors'
import { createDictionary } from '../utils/dictionary'
import { resolveInvocation } from './invocation-resolver'
import type { ResolvedInvocation } from './invocation-resolver'

export interface ContainerOptions {
  argv?: string[]
  cwd?: string
  stderr?: Writable
  stdin?: Readable
  signal?: AbortSignal
  stdout?: Writable
}

export interface InvocationResult {
  readonly exitCode: number
  readonly result: unknown
}

interface ActivatedScope {
  instance: unknown
  kind: 'command' | 'module' | 'option-command'
  managedByInjector?: boolean
  name: string
}

interface ErrorResolution {
  exception: Exception
  handled: boolean
}

interface DispatchParams {
  injector: RuntimeInjector
  invocation: ResolvedInvocation
  options: UserOption
  scopes: ActivatedScope[]
  skipsValidation: boolean
  values: Map<ProviderToken, unknown>
}

interface ScopeDisposeFailure {
  error: Error
  kind: ActivatedScope['kind']
  name: string
}

export class Container {
  private application: CompiledApplication
  private argv: string[]
  private cwd: string
  private stderr: Writable
  private stdin: Readable
  private signal: AbortSignal
  private stdout: Writable

  constructor(application: CompiledApplication, options: ContainerOptions = {}) {
    this.application = application
    this.argv = options.argv ?? process.argv.slice(2)
    this.cwd = options.cwd ?? process.cwd()
    this.stderr = options.stderr ?? process.stderr
    this.stdin = options.stdin ?? process.stdin
    this.signal = options.signal ?? new AbortController().signal
    this.stdout = options.stdout ?? process.stdout
  }

  async run(): Promise<InvocationResult> {
    const context = this.invocationContext()
    const values = new Map<ProviderToken, unknown>([[Context, context]])
    const injector = new RuntimeInjector(this.application.graph, values)
    const scopes: ActivatedScope[] = []
    let executionError: unknown
    let result: unknown

    try {
      const rootPlan = this.application.commandGraph.rootNode().optionPlan
      injector.allowOptions(rootPlan.providers.map(option => option.record))
      const rootScope = await this.activateModule(
        injector,
        this.application.graph.root,
        scopes,
        false,
      )
      const invocation = this.resolveInvocation()
      this.printDeprecations(invocation)
      injector.allowOptions(invocation.plan.providers.map(option => option.record))
      const owner = this.executionOwner(invocation)
      const ownerScope =
        owner === this.application.graph.root
          ? undefined
          : await this.activateModule(injector, owner, scopes, false)
      const options = invocation.parsed.options
      const skipsValidation = Boolean(invocation.action)
      await this.activateProviderOptions(
        injector,
        invocation,
        options,
        owner,
        skipsValidation,
      )
      await this.initializeScope(rootScope)
      await this.initializeScope(ownerScope)
      this.selectContext(context, invocation)
      result = await this.dispatch({
        injector,
        invocation,
        options,
        scopes,
        skipsValidation,
        values,
      })
    } catch (error) {
      executionError = error
    }

    const { outcome, pendingError } = await this.executionOutcome(
      executionError,
      result,
      scopes,
      context,
    )
    const disposeErrors = await this.dispose(injector, scopes, outcome)
    const finalError = this.finalError(pendingError, disposeErrors)
    if (finalError) {
      failContext(context)
      throw finalError
    }

    return { exitCode: context.exitCode, result }
  }

  private resolveInvocation(): ResolvedInvocation {
    return resolveInvocation(this.application.commandGraph, this.argv)
  }

  private printDeprecations(invocation: ResolvedInvocation) {
    const target = invocation.action ?? invocation.endpoint
    if (target?.kind === 'command') {
      const command = target.record.command
      if (command?.deprecated) {
        this.stderr.write(
          deprecationNotice(
            `Command "${command.path.join(' ')}"`,
            command.deprecated,
          ),
        )
      }
    }

    const warned = new Set<string>()
    invocation.effectiveOptions.forEach(option => {
      if (!option.deprecated || warned.has(option.name)) return
      if (!invocation.parsed.supplied.has(option.name)) return
      warned.add(option.name)
      this.stderr.write(
        deprecationNotice(`Option "--${option.name}"`, option.deprecated),
      )
    })
  }

  private executionOwner(invocation: ResolvedInvocation): CompiledModule {
    if (invocation.action?.kind === 'option-command') return invocation.action.owner
    if (invocation.action) return invocation.action.record.owner
    return invocation.endpoint?.record.owner ?? this.application.graph.root
  }

  private async activateProviderOptions(
    injector: RuntimeInjector,
    invocation: ResolvedInvocation,
    options: UserOption,
    owner: CompiledModule,
    skipsValidation: boolean,
  ) {
    for (const binding of invocation.plan.providerBindings) {
      if (
        binding.provider.owner !== this.application.graph.root &&
        binding.provider.owner !== owner
      )
        continue
      await injector.activateOption(binding.provider.record, instance => {
        const params = {
          fieldOptions: binding.fieldOptions,
          instance,
          options,
          supplied: invocation.parsed.supplied,
        }
        if (skipsValidation) {
          hydrateFieldOptions(params)
          return
        }
        bindFieldOptions(params)
      })
    }
  }

  private async dispatch({
    injector,
    invocation,
    options,
    scopes,
    skipsValidation,
    values,
  }: DispatchParams): Promise<unknown> {
    const target = invocation.action ?? invocation.endpoint
    if (!target) return undefined
    if (target.kind === 'option-command') {
      values.set(ARGS, this.commandArgs(invocation, target.path, options))
      const instance = await injector.activateOption(
        target.declaration.record,
        () => {},
      )
      scopes.push({
        instance,
        kind: 'option-command',
        managedByInjector: true,
        name: target.declaration.target.name || '(anonymous option command)',
      })
      const methodParams = await injector.parameters(
        Object.getPrototypeOf(instance) as object,
        target.handler.methodName,
        target.owner,
      )
      return Promise.resolve(
        (instance as any)[target.handler.methodName](...methodParams),
      )
    }

    const record = target.record
    const instance = await injector.instantiate(record.handler, record.owner)
    scopes.push({
      instance,
      kind: 'command',
      name: record.handler.name || '(anonymous command)',
    })
    const fieldOptions = invocation.plan.commandBindings.get(record) ?? []
    const params = {
      fieldOptions,
      instance,
      options,
      supplied: invocation.parsed.supplied,
    }
    if (skipsValidation) hydrateFieldOptions(params)
    else bindFieldOptions(params)
    values.set(ARGS, this.commandArgs(invocation, target.path, options))
    if (hasOnInit(instance)) await instance.onInit()

    const methodParams = await injector.parameters(
      Object.getPrototypeOf(instance) as object,
      target.handler.methodName,
      record.owner,
    )
    return Promise.resolve(
      (instance as any)[target.handler.methodName](...methodParams),
    )
  }

  private async activateModule(
    injector: RuntimeInjector,
    module: CompiledModule,
    scopes: ActivatedScope[],
    initialize = true,
  ): Promise<ActivatedScope | undefined> {
    if (typeof module.input !== 'function') return undefined
    const instance = await injector.instantiate(module.input as Type, module)
    const scope: ActivatedScope = {
      instance,
      kind: 'module',
      name: module.name,
    }
    scopes.push(scope)
    if (initialize) await this.initializeScope(scope)
    return scope
  }

  private async initializeScope(scope: ActivatedScope | undefined): Promise<void> {
    if (scope && hasOnInit(scope.instance)) await scope.instance.onInit()
  }

  private selectContext(context: Context, invocation: ResolvedInvocation) {
    selectContextInvocation(
      context,
      this.application.commandGraph,
      invocation.match.node,
    )
    const target = invocation.action ?? invocation.endpoint
    if (target?.kind === 'command') selectContextCommand(context, target.command)
  }

  private async executionOutcome(
    error: unknown,
    result: unknown,
    scopes: ActivatedScope[],
    context: Context,
  ): Promise<{
    outcome: ExecutionOutcome
    pendingError?: Error
  }> {
    if (error === undefined) {
      return {
        outcome: Object.freeze({
          exitCode: context.exitCode,
          result,
          status: 'success',
        }),
      }
    }

    failContext(context)
    const resolution = await this.resolveError(error, scopes, context)
    return {
      outcome: Object.freeze({
        error: resolution.exception,
        exitCode: context.exitCode,
        handled: resolution.handled,
        status: 'error',
      }),
      ...(resolution.handled ? {} : { pendingError: resolution.exception }),
    }
  }

  private async resolveError(
    error: unknown,
    scopes: ActivatedScope[],
    context: Context,
  ): Promise<ErrorResolution> {
    let exception = normalizeRuntimeError(error)
    let exceptionContext = new ExceptionContext()
    let handled = false
    if (exception.scope !== ErrorScope.SYSTEM) {
      for (const scope of scopes.slice().reverse()) {
        if (!hasOnError(scope.instance)) continue
        try {
          await scope.instance.onError(exception, exceptionContext)
          handled = true
          break
        } catch (hookError) {
          exception = normalizeRuntimeError(hookError)
          exceptionContext = new ExceptionContext()
          if (exception.scope === ErrorScope.SYSTEM) break
        }
      }
    }

    if (exception.scope === ErrorScope.RUNTIME_PRINT) {
      if (!exceptionContext.printPrevented) printException(exception, this.stderr)
      handled = true
    }
    if (!handled) failContext(context)
    return { exception, handled }
  }

  private async dispose(
    injector: RuntimeInjector,
    scopes: ActivatedScope[],
    outcome: ExecutionOutcome,
  ): Promise<Error[]> {
    const failures: ScopeDisposeFailure[] = []
    for (const scope of scopes.slice().reverse()) {
      if (scope.managedByInjector || !hasOnDispose(scope.instance)) continue
      try {
        await scope.instance.onDispose(outcome)
      } catch (error) {
        failures.push({
          error: normalizeError(error),
          kind: scope.kind,
          name: scope.name,
        })
      }
    }

    const errors: Error[] = failures.map(failure => failure.error)
    try {
      await injector.dispose(outcome)
    } catch (error) {
      errors.push(normalizeError(error))
    }
    if (!failures.length) return errors

    errors.unshift(
      new InternalException(RUNTIME.PROVIDER_DISPOSE, {
        cause: failures[0].error,
        details: { errors: failures },
        message: failures[0].error.message,
        scope: ErrorScope.RUNTIME,
      }),
    )
    return errors
  }

  private finalError(
    pendingError: Error | undefined,
    disposeErrors: Error[],
  ): Error | undefined {
    if (pendingError) {
      if (disposeErrors.length && isException(pendingError)) {
        pendingError.details.disposeErrors = disposeErrors
      }
      return pendingError
    }
    return disposeErrors[0]
  }

  private invocationContext(): Context {
    return new Context(
      this.application.commandCatalog,
      {
        stderr: this.stderr,
        stdin: this.stdin,
        stdout: this.stdout,
      },
      this.cwd,
      this.signal,
    )
  }

  private commandArgs(
    invocation: ResolvedInvocation,
    path: readonly string[],
    options: UserOption,
  ): CommandArgs {
    const readonlyOptions = createDictionary<ArgsOptionValue>()
    Object.keys(options).forEach(key => {
      const value = options[key]
      readonlyOptions[key] = Array.isArray(value)
        ? Object.freeze(value.slice())
        : value
    })

    return Object.freeze({
      inputs: Object.freeze(
        invocation.parsed.positionals.slice(invocation.match.consumed),
      ),
      invokedPath: Object.freeze(invocation.match.invokedPath.slice()),
      options: Object.freeze(readonlyOptions),
      path: Object.freeze(path.slice()),
      raw: Object.freeze(this.argv.slice()),
    })
  }
}

const normalizeRuntimeError = (error: unknown): Exception => {
  if (isException(error)) return error
  const cause = normalizeError(error)
  return new InternalException(RUNTIME.HANDLER_ERROR, {
    cause,
    details: { error: cause },
    message: cause.message,
    scope: ErrorScope.RUNTIME,
  })
}

const normalizeError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error))

const deprecationNotice = (subject: string, deprecated: Deprecation): string => {
  const detail = deprecated === true ? '' : ` ${deprecated}`
  return `${subject} is deprecated.${detail}\n`
}
