import { RUNTIME, SYSTEM } from '@func/contracts/core-errors'
import type { Readable, Writable } from 'node:stream'
import type { CompiledApplication } from '../application/model'
import { snapshotOptions } from '../argv/option-record'
import {
  Context,
  failContext,
  selectContextCommand,
  selectContextInvocation,
  selectContextOptions,
  selectContextResultOutput,
  settleContext,
} from './context'
import { providerRecord, providerRecords } from '../di/module-compiler'
import type { CompiledModule, ProviderRecord } from '../di/module-compiler'
import { RuntimeInjector } from '../di/injector'
import { hasOnDispose, hasOnInit } from '../di/lifecycle'
import type { LifecycleFault } from '../di/lifecycle'
import type { ProviderToken } from '../di/types'
import { ARGS, STDERR, STDIN, STDOUT } from './injection'
import type { HandlerParams } from '../commands/types'
import type { Deprecation } from '../deprecation'
import { bindFieldOptions } from '../options/field-binding'
import type { UserOption } from '../options/types'
import type { Exception } from '../shared/errors'
import { environment } from '../shared/environment'
import type { Environment } from '../shared/environment'
import { ErrorScope, InternalException, isException } from '../shared/errors'
import {
  hasJsonOutputOption,
  JSON_OUTPUT_OPTIONS,
} from '../subpath/json-output/options'
import type { JsonOutputOptions } from '../subpath/json-output/options'
import { resolveInvocation } from './invocation-resolver'
import type { ResolvedInvocation } from './invocation-resolver'
import type { Args as CommandArgs } from './args'
import {
  APP_FILTER,
  APP_INTERCEPTOR,
  MODULE_FILTER,
  MODULE_INTERCEPTOR,
  catchMatchers,
} from './enhancers'
import type {
  CallHandler,
  ExceptionFilter,
  ExceptionMatcher,
  Interceptor,
} from './enhancers'
import { OutputHost, settleOutput } from './output'

export interface ContainerOptions {
  argv?: readonly string[]
  cwd?: string
  env?: Environment
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
  kind: 'command' | 'filter' | 'interceptor' | 'module' | 'option-command'
  managedByInjector?: boolean
  name: string
}

interface ErrorResolution {
  exception: Exception
  handled: boolean
  result: unknown
}

interface ExecutionState {
  exception?: Exception
  handled: boolean
}

interface RuntimeEnhancers {
  filters: ExceptionFilter[]
  interceptors: Interceptor[]
}

interface DispatchParams {
  injector: RuntimeInjector
  invocation: ResolvedInvocation
  options: UserOption
  scopes: ActivatedScope[]
  validatesFields: boolean
  values: Map<ProviderToken, unknown>
}

type InvocationResolution =
  | { error: unknown; success: false }
  | { invocation: ResolvedInvocation; success: true }

export class Container {
  private application: CompiledApplication
  private argv: string[]
  private cwd: string
  private env: Environment
  private stderr: Writable
  private stdin: Readable
  private signal: AbortSignal
  private stdout: Writable

  constructor(application: CompiledApplication, options: ContainerOptions = {}) {
    this.application = application
    this.argv = [...(options.argv ?? process.argv.slice(2))]
    this.cwd = options.cwd ?? process.cwd()
    this.env = environment.normalize(options.env ?? process.env)
    this.stderr = options.stderr ?? process.stderr
    this.stdin = options.stdin ?? process.stdin
    this.signal = options.signal ?? new AbortController().signal
    this.stdout = options.stdout ?? process.stdout
  }

  async run(): Promise<InvocationResult> {
    const resolution = this.resolveInvocation()
    const output = new OutputHost(
      this.stdout,
      this.stderr,
      this.managesStdout(resolution),
    )
    const context = this.invocationContext(output)
    const values = new Map<ProviderToken, unknown>([
      [Context, context],
      [OutputHost, output],
      [STDERR, context.io.stderr],
      [STDIN, context.io.stdin],
      [STDOUT, context.io.stdout],
    ])
    const injector = new RuntimeInjector(this.application.graph, values)
    const scopes: ActivatedScope[] = []
    const execution: ExecutionState = { handled: false }
    let enhancers: RuntimeEnhancers = { filters: [], interceptors: [] }
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
      if (!resolution.success) {
        enhancers = await this.activateApplicationEnhancers(injector)
        result = await this.invokeInterceptors(
          enhancers.interceptors,
          context,
          enhancers.filters,
          execution,
          async () => {
            throw resolution.error
          },
        )
      } else {
        const invocation = resolution.invocation
        this.printDeprecations(invocation)
        injector.allowOptions(
          invocation.plan.providers
            .filter(option => option.owner !== this.application.graph.root)
            .map(option => option.record),
        )
        const owner = this.executionOwner(invocation)
        const ownerScope =
          owner === this.application.graph.root
            ? undefined
            : await this.activateModule(injector, owner, scopes, false)
        const options = invocation.parsed.options
        const validatesFields = !invocation.action
        this.selectContext(context, invocation)
        enhancers = await this.activateEnhancers(injector, invocation, owner, scopes)
        result = await this.invokeInterceptors(
          enhancers.interceptors,
          context,
          enhancers.filters,
          execution,
          async () => {
            await this.activateProviderOptions(
              injector,
              invocation,
              options,
              owner,
              validatesFields,
            )
            await this.initializeScope(rootScope)
            await this.initializeScope(ownerScope)
            return this.dispatch({
              injector,
              invocation,
              options,
              scopes,
              validatesFields,
              values,
            })
          },
        )
      }
    } catch (error) {
      executionError = error
    }

    if (executionError !== undefined && execution.exception !== executionError) {
      const errorResolution = await this.resolveError(
        executionError,
        enhancers.filters,
        context,
      )
      result = errorResolution.result
      execution.exception = errorResolution.exception
      execution.handled = errorResolution.handled
    }

    const finalError =
      execution.exception && !execution.handled ? execution.exception : undefined
    const exitCode = context.exitCode
    settleContext(context)
    const outputSettlement = settleOutput(output)
    const lifecycleFaults = await this.dispose(injector, scopes)
    this.reportLifecycleFaults(lifecycleFaults)
    if (finalError !== undefined) {
      outputSettlement.rollback()
      throw finalError
    }

    outputSettlement.commit()
    return { exitCode, result }
  }

  private resolveInvocation(): InvocationResolution {
    try {
      return {
        invocation: resolveInvocation(this.application.commandGraph, this.argv),
        success: true,
      }
    } catch (error) {
      return { error, success: false }
    }
  }

  private managesStdout(resolution: InvocationResolution): boolean {
    if (!hasJsonOutputOption(this.argv)) return false
    const root = this.application.graph.root
    const owner = resolution.success ? resolution.invocation.plan.owner : root
    const record =
      providerRecord(owner, JSON_OUTPUT_OPTIONS) ??
      (owner === root ? undefined : providerRecord(root, JSON_OUTPUT_OPTIONS))
    if (!record || !('useValue' in record.definition)) return false
    const options: unknown = record.definition.useValue
    return isJsonOutputOptions(options) && options.suppressStdout
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
    return invocation.plan.owner
  }

  private async activateEnhancers(
    injector: RuntimeInjector,
    invocation: ResolvedInvocation,
    owner: CompiledModule,
    scopes: ActivatedScope[],
  ): Promise<RuntimeEnhancers> {
    const root = this.application.graph.root
    const target = invocation.action ?? invocation.endpoint
    const commandRecord = target?.kind === 'command' ? target.record : undefined
    const moduleInterceptorRecords =
      owner === root ? [] : providerRecords(owner, MODULE_INTERCEPTOR)
    const moduleFilterRecords =
      owner === root ? [] : providerRecords(owner, MODULE_FILTER)
    const commandInterceptors = commandRecord
      ? await this.activateAttachedEnhancers(
          injector,
          commandRecord.interceptors,
          owner,
          scopes,
          'interceptor',
        )
      : []
    const commandFilters = commandRecord
      ? await this.activateAttachedEnhancers(
          injector,
          commandRecord.filters,
          owner,
          scopes,
          'filter',
        )
      : []
    const application = await this.activateApplicationEnhancers(injector)
    const moduleFilters = (
      await this.activateProviderEnhancers(injector, moduleFilterRecords)
    ).map(value => this.exceptionFilter(value))
    const moduleInterceptors = (
      await this.activateProviderEnhancers(injector, moduleInterceptorRecords)
    ).map(value => this.interceptor(value))

    return {
      filters: commandFilters.concat(moduleFilters, application.filters),
      interceptors: uniqueInterceptors(
        application.interceptors.concat(moduleInterceptors, commandInterceptors),
      ),
    }
  }

  private async activateApplicationEnhancers(
    injector: RuntimeInjector,
  ): Promise<RuntimeEnhancers> {
    const root = this.application.graph.root
    const interceptorRecords = this.applicationProviderRecords(
      APP_INTERCEPTOR,
    ).concat(providerRecords(root, MODULE_INTERCEPTOR))
    const filterRecords = providerRecords(root, MODULE_FILTER).concat(
      this.applicationProviderRecords(APP_FILTER),
    )
    return {
      filters: (await this.activateProviderEnhancers(injector, filterRecords)).map(
        value => this.exceptionFilter(value),
      ),
      interceptors: (
        await this.activateProviderEnhancers(injector, interceptorRecords)
      ).map(value => this.interceptor(value)),
    }
  }

  private applicationProviderRecords(token: ProviderToken): ProviderRecord[] {
    return this.application.graph.modules.flatMap(module =>
      (module.multiProviders.get(token) ?? []).slice(),
    )
  }

  private async activateProviderEnhancers(
    injector: RuntimeInjector,
    records: readonly ProviderRecord[],
  ): Promise<unknown[]> {
    const instances: unknown[] = []
    for (const record of records) {
      instances.push(await injector.activateProvider(record))
    }
    return instances
  }

  private async activateAttachedEnhancers<T>(
    injector: RuntimeInjector,
    targets: readonly (new (...args: never[]) => T)[],
    owner: CompiledModule,
    scopes: ActivatedScope[],
    kind: 'filter' | 'interceptor',
  ): Promise<T[]> {
    const instances: T[] = []
    for (const target of targets) {
      const instance = await injector.instantiate(target, owner)
      const scope: ActivatedScope = {
        instance,
        kind,
        name: target.name || `(anonymous ${kind})`,
      }
      scopes.push(scope)
      await this.initializeScope(scope)
      instances.push(instance)
    }
    return instances
  }

  private interceptor(value: unknown): Interceptor {
    if (isInterceptor(value)) return value
    throw new InternalException(SYSTEM.INVALID_PROVIDER, {
      details: { provider: value, type: 'interceptor' },
    })
  }

  private exceptionFilter(value: unknown): ExceptionFilter {
    if (isExceptionFilter(value)) return value
    throw new InternalException(SYSTEM.INVALID_PROVIDER, {
      details: { provider: value, type: 'filter' },
    })
  }

  private async activateProviderOptions(
    injector: RuntimeInjector,
    invocation: ResolvedInvocation,
    options: UserOption,
    owner: CompiledModule,
    validatesFields: boolean,
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
          validate: validatesFields,
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
    validatesFields,
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
      return this.invokeHandler(injector, instance, target.handler, target.owner)
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
      validate: validatesFields,
    }
    bindFieldOptions(params)
    values.set(ARGS, this.commandArgs(invocation, target.path, options))
    if (hasOnInit(instance)) await instance.onInit()
    return this.invokeHandler(injector, instance, target.handler, record.owner)
  }

  private async invokeHandler(
    injector: RuntimeInjector,
    instance: unknown,
    handler: HandlerParams,
    owner: CompiledModule,
  ): Promise<unknown> {
    const methodParams = await injector.parameters(
      objectPrototype(instance),
      handler.methodName,
      owner,
    )
    const method = handlerMethod(instance, handler.methodName)
    const result: unknown = Reflect.apply(method, instance, methodParams)
    return result
  }

  private async invokeInterceptors(
    interceptors: readonly Interceptor[],
    context: Context,
    filters: readonly ExceptionFilter[],
    execution: ExecutionState,
    handler: () => Promise<unknown>,
  ): Promise<unknown> {
    const invoke = async (index: number): Promise<unknown> => {
      try {
        if (index >= interceptors.length) return await handler()
        const interceptor = interceptors[index]
        const next: CallHandler = Object.freeze({
          handle: () => invoke(index + 1),
        })
        return await interceptor.intercept(context, next)
      } catch (error) {
        if (execution.exception === error && !execution.handled) throw error
        const resolution = await this.resolveError(error, filters, context)
        execution.exception = resolution.exception
        execution.handled = resolution.handled
        if (resolution.handled) return resolution.result
        throw resolution.exception
      }
    }

    return invoke(0)
  }

  private async activateModule(
    injector: RuntimeInjector,
    module: CompiledModule,
    scopes: ActivatedScope[],
    initialize = true,
  ): Promise<ActivatedScope | undefined> {
    if (typeof module.input !== 'function') return undefined
    const instance = await injector.instantiate(module.input, module)
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
    selectContextOptions(context, snapshotOptions(invocation.parsed.options))
    const target = invocation.action ?? invocation.endpoint
    if (target?.kind === 'command') selectContextCommand(context, target.command)
    selectContextResultOutput(
      context,
      target?.kind === 'option-command' &&
        target.declaration.option.textOutput === 'stdout'
        ? 'stdout'
        : 'return',
    )
  }

  private async resolveError(
    error: unknown,
    filters: readonly ExceptionFilter[],
    context: Context,
  ): Promise<ErrorResolution> {
    let exception = normalizeRuntimeError(error)
    failContext(context)
    for (const filter of filters) {
      if (!this.filterMatches(filter, exception)) continue
      try {
        const result = await filter.catch(exception, context)
        return { exception, handled: true, result }
      } catch (filterError) {
        exception = normalizeRuntimeError(filterError)
      }
    }

    if (isDefaultRoutable(exception)) {
      context.io.stderr.write(`${exception.message}\n`)
      return { exception, handled: true, result: undefined }
    }
    return { exception, handled: false, result: undefined }
  }

  private filterMatches(filter: ExceptionFilter, exception: Exception): boolean {
    const matchers = catchMatchers(filter.constructor)
    if (!matchers) {
      throw new InternalException(SYSTEM.INVALID_PROVIDER, {
        details: { filter: filter.constructor.name, type: 'filter' },
      })
    }
    if (!matchers.length) return true
    return matchers.some(matcher => this.exceptionMatches(exception, matcher))
  }

  private exceptionMatches(
    exception: Exception,
    matcher: ExceptionMatcher,
  ): boolean {
    if (typeof matcher === 'function') {
      const cause: unknown = exception.cause
      return (
        exception instanceof matcher ||
        (cause instanceof Error && cause instanceof matcher)
      )
    }
    return (
      exception.scope === matcher ||
      exception.code === matcher ||
      exception.code.endsWith(`_${matcher}`)
    )
  }

  private async dispose(
    injector: RuntimeInjector,
    scopes: ActivatedScope[],
  ): Promise<LifecycleFault[]> {
    const faults: LifecycleFault[] = []
    for (const scope of scopes.slice().reverse()) {
      if (scope.managedByInjector || !hasOnDispose(scope.instance)) continue
      try {
        await scope.instance.onDispose()
      } catch (error) {
        faults.push({
          error: normalizeError(error),
          kind: scope.kind,
          name: scope.name,
        })
      }
    }

    return faults.concat(await injector.dispose())
  }

  private reportLifecycleFaults(faults: readonly LifecycleFault[]): void {
    faults.forEach(fault => {
      this.stderr.write(
        `Lifecycle hook ${fault.kind} "${fault.name}".onDispose() failed: ${singleLine(fault.error.message)}\n`,
      )
    })
  }

  private invocationContext(output: OutputHost): Context {
    return new Context(
      this.application.commandGraph.commands(),
      {
        stderr: output.stderr,
        stdin: this.stdin,
        stdout: output.stdout,
      },
      this.cwd,
      this.signal,
      {
        appName: this.application.appName,
        argv: this.argv,
        env: this.env,
      },
    )
  }

  private commandArgs(
    invocation: ResolvedInvocation,
    path: readonly string[],
    options: UserOption,
  ): CommandArgs<Record<string, unknown>> {
    return Object.freeze({
      inputs: Object.freeze(
        invocation.parsed.positionals.slice(invocation.match.consumed),
      ),
      invokedPath: Object.freeze(invocation.match.invokedPath.slice()),
      options: snapshotOptions(options),
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

const defaultRoutableCodes = new Set<string>([
  RUNTIME.AMBIGUOUS_INVOCATION,
  RUNTIME.HANDLER_ERROR,
  RUNTIME.INVALID_CONTEXT,
  RUNTIME.INVALID_EXIT_CODE,
  RUNTIME.MULTIPLE_OPTIONS,
  RUNTIME.OUTPUT_SERIALIZATION,
  RUNTIME.PARSE,
  RUNTIME.UNKNOWN_COMMAND,
  RUNTIME.UNKNOWN_OPTION,
  RUNTIME.VALIDATION,
])

const isDefaultRoutable = (exception: Exception): boolean =>
  exception.scope === ErrorScope.RUNTIME &&
  defaultRoutableCodes.has(exception.code.slice(`${ErrorScope.RUNTIME}_`.length))

const uniqueInterceptors = (interceptors: readonly Interceptor[]): Interceptor[] => {
  const last = new Map<Function, number>()
  interceptors.forEach((interceptor, index) => {
    last.set(interceptor.constructor, index)
  })
  return interceptors.filter(
    (interceptor, index) => last.get(interceptor.constructor) === index,
  )
}

const normalizeError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error))

const singleLine = (value: string): string =>
  value.replace(/[\r\n]+/g, ' ').trim() || '(no error message)'

type RuntimeMethod = (...args: never[]) => unknown

const objectPrototype = (value: unknown): object => {
  if (!isObjectLike(value)) {
    throw handlerError('Handler instance must be an object.', value)
  }
  const prototype: unknown = Object.getPrototypeOf(value)
  if (isObjectLike(prototype)) return prototype
  throw handlerError('Handler instance must have an object prototype.', value)
}

const handlerMethod = (value: unknown, methodName: string): RuntimeMethod => {
  if (!isObjectLike(value)) {
    throw handlerError('Handler instance must be an object.', value)
  }
  const method: unknown = Reflect.get(value, methodName)
  if (isRuntimeMethod(method)) return method
  throw handlerError(`Handler "${methodName}" must be a function.`, value, {
    method: methodName,
  })
}

const handlerError = (
  message: string,
  instance: unknown,
  details: Record<string, unknown> = {},
): InternalException =>
  new InternalException(RUNTIME.HANDLER_ERROR, {
    details: { ...details, instance },
    message,
    scope: ErrorScope.RUNTIME,
  })

const isObjectLike = (value: unknown): value is object =>
  (typeof value === 'object' && value !== null) || typeof value === 'function'

const isJsonOutputOptions = (value: unknown): value is JsonOutputOptions =>
  isObjectLike(value) &&
  'suppressStdout' in value &&
  typeof value.suppressStdout === 'boolean'

const isInterceptor = (value: unknown): value is Interceptor =>
  isObjectLike(value) &&
  'intercept' in value &&
  typeof value.intercept === 'function'

const isExceptionFilter = (value: unknown): value is ExceptionFilter =>
  isObjectLike(value) && 'catch' in value && typeof value.catch === 'function'

const isRuntimeMethod = (value: unknown): value is RuntimeMethod =>
  typeof value === 'function'

const deprecationNotice = (subject: string, deprecated: Deprecation): string => {
  const detail = deprecated === true ? '' : ` ${deprecated}`
  return `${subject} is deprecated.${detail}\n`
}
