import { RUNTIME } from '@func/contracts/core-errors'
import type { Readable, Writable } from 'node:stream'
import type { CompiledApplication } from '../application/model'
import { snapshotOptions } from '../argv/option-record'
import {
  Context,
  failContext,
  selectContextInvocation,
  settleContext,
} from './context'
import { providerRecord } from '../di/module-graph'
import type { CompiledModule } from '../di/module-graph'
import { RuntimeInjector } from '../di/injector'
import { hasOnDispose, hasOnError, hasOnInit } from '../di/lifecycle'
import type { LifecycleFault } from '../di/lifecycle'
import type { ProviderToken } from '../di/types'
import { ARGS, STDERR, STDIN, STDOUT } from './injection'
import type { HandlerParams } from '../commands/types'
import type { Deprecation } from '../deprecation'
import { bindFieldOptions } from '../options/field-binding'
import type { ParsedUserOption, UserOption } from '../options/types'
import type { Exception } from '../shared/errors'
import { environment } from '../shared/environment'
import type { Environment } from '../shared/environment'
import { ErrorScope, InternalException, isException } from '../shared/errors'
import { hasJsonOutputOption, JsonOutput } from '../subpath/json-output/runtime'
import { resolveInvocation } from './invocation-resolver'
import type { ResolvedInvocation } from './invocation-resolver'
import type { Args as CommandArgs } from './args'
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
  kind: 'command' | 'module' | 'option-command'
  managedByInjector?: boolean
  name: string
  owner: CompiledModule
}

interface ErrorResolution {
  exception: Exception
  handled: boolean
}

interface DispatchParams {
  injector: RuntimeInjector
  invocation: ResolvedInvocation
  options: ParsedUserOption
  scopes: ActivatedScope[]
  validatesFields: boolean
  values: Map<ProviderToken, unknown>
  onScopeActivated(scope: ActivatedScope): void
}

type InvocationResolution =
  | { error: unknown; success: false }
  | { invocation: ResolvedInvocation; success: true }

export class Container {
  private application: CompiledApplication
  private argv: readonly string[]
  private cwd: string
  private env: Environment
  private stderr: Writable
  private stdin: Readable
  private signal: AbortSignal
  private stdout: Writable

  constructor(application: CompiledApplication, options: ContainerOptions = {}) {
    this.application = application
    this.argv = immutableArgv(options.argv ?? process.argv.slice(2))
    this.cwd = options.cwd ?? process.cwd()
    this.env = environment.normalize(options.env ?? process.env)
    this.stderr = options.stderr ?? process.stderr
    this.stdin = options.stdin ?? process.stdin
    this.signal = options.signal ?? new AbortController().signal
    this.stdout = options.stdout ?? process.stdout
  }

  async run(): Promise<InvocationResult> {
    const resolution = this.resolveInvocation()
    const supportsJsonOutput = this.supportsJsonOutput(resolution)
    const jsonOutputEnabled = supportsJsonOutput && hasJsonOutputOption(this.argv)
    const output = new OutputHost(this.stdout, this.stderr, jsonOutputEnabled)
    const context = this.invocationContext(output)
    if (resolution.success) this.selectContext(context, resolution.invocation)
    const values = new Map<ProviderToken, unknown>([
      [Context, context],
      [OutputHost, output],
      [STDERR, context.io.stderr],
      [STDIN, context.io.stdin],
      [STDOUT, context.io.stdout],
    ])
    if (supportsJsonOutput) {
      values.set(JsonOutput, new JsonOutput(jsonOutputEnabled, output))
    }
    const injector = new RuntimeInjector(this.application.graph, values)
    const scopes: ActivatedScope[] = []
    let errorScopes: ActivatedScope[] = []
    let executionError: unknown
    let result: unknown

    try {
      const rootPlan = this.application.commandGraph.rootNode().optionPlan
      injector.allowOptions(rootPlan.providers.map(option => option.record))
      const rootScope = await this.activateModule(
        injector,
        this.application.graph.root,
        scopes,
      )
      errorScopes = this.errorScopes(scopes, rootScope)
      if (!resolution.success) {
        throw resolution.error
      }

      const invocation = resolution.invocation
      this.printDeprecations(invocation)
      injector.allowOptions(
        invocation.plan.providers
          .filter(option => option.owner !== this.application.graph.root)
          .map(option => option.record),
      )
      const owner = invocation.plan.owner
      const ownerScope =
        owner === this.application.graph.root
          ? undefined
          : await this.activateModule(injector, owner, scopes)
      errorScopes = this.errorScopes(scopes, ownerScope ?? rootScope)
      const options = invocation.parsed.options
      const validatesFields = !invocation.action
      await this.activateProviderOptions(
        injector,
        invocation,
        options,
        owner,
        validatesFields,
      )
      errorScopes = this.errorScopes(scopes, rootScope)
      await this.initializeScope(rootScope)
      errorScopes = this.errorScopes(scopes, ownerScope ?? rootScope)
      await this.initializeScope(ownerScope)
      result = await this.dispatch({
        injector,
        invocation,
        options,
        scopes,
        validatesFields,
        values,
        onScopeActivated: scope => {
          errorScopes = this.errorScopes(scopes, scope)
        },
      })
    } catch (error) {
      executionError = error
    }

    let finalError: Exception | undefined
    if (executionError !== undefined) {
      result = undefined
      const errorResolution = await this.resolveError(
        executionError,
        errorScopes,
        context,
      )
      if (!errorResolution.handled) finalError = errorResolution.exception
    }

    const lifecycleFaults = await this.dispose(injector, scopes)
    for (const fault of lifecycleFaults) {
      const errorResolution = await this.resolveError(
        fault.error,
        this.faultErrorScopes(scopes, fault),
        context,
      )
      if (!errorResolution.handled && finalError === undefined) {
        finalError = errorResolution.exception
      }
    }

    const exitCode = context.exitCode
    settleContext(context)
    const outputSettlement = settleOutput(output)
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

  private supportsJsonOutput(resolution: InvocationResolution): boolean {
    const root = this.application.graph.root
    const owner = resolution.success ? resolution.invocation.plan.owner : root
    const record =
      providerRecord(owner, JsonOutput) ??
      (owner === root ? undefined : providerRecord(root, JsonOutput))
    return record !== undefined
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
    onScopeActivated,
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
        activatedInstance => {
          const scope: ActivatedScope = {
            instance: activatedInstance,
            kind: 'option-command',
            managedByInjector: true,
            name: target.declaration.target.name || '(anonymous option command)',
            owner: target.owner,
          }
          scopes.push(scope)
          onScopeActivated(scope)
        },
      )
      return this.invokeHandler(injector, instance, target.handler, target.owner)
    }

    const record = target.record
    const instance = await injector.instantiate(record.handler, record.owner)
    const scope: ActivatedScope = {
      instance,
      kind: 'command',
      name: record.handler.name || '(anonymous command)',
      owner: record.owner,
    }
    scopes.push(scope)
    onScopeActivated(scope)
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

  private async activateModule(
    injector: RuntimeInjector,
    module: CompiledModule,
    scopes: ActivatedScope[],
  ): Promise<ActivatedScope | undefined> {
    if (typeof module.input !== 'function') return undefined
    const instance = await injector.instantiate(module.input, module)
    const scope: ActivatedScope = {
      instance,
      kind: 'module',
      name: module.name,
      owner: module,
    }
    scopes.push(scope)
    return scope
  }

  private async initializeScope(scope: ActivatedScope | undefined): Promise<void> {
    if (scope && hasOnInit(scope.instance)) await scope.instance.onInit()
  }

  private selectContext(context: Context, invocation: ResolvedInvocation) {
    const target = invocation.action ?? invocation.endpoint
    const args = this.commandArgs(
      invocation,
      target?.path ?? invocation.match.node.path,
      invocation.parsed.options,
    )
    selectContextInvocation(
      context,
      args,
      this.application.commandGraph,
      invocation.match.node,
      target?.kind === 'command' ? target.command : undefined,
    )
  }

  private async resolveError(
    error: unknown,
    scopes: readonly ActivatedScope[],
    context: Context,
  ): Promise<ErrorResolution> {
    let exception = normalizeRuntimeError(error)
    failContext(context)
    for (const scope of scopes) {
      if (!hasOnError(scope.instance)) continue
      try {
        await scope.instance.onError(exception, context)
        return { exception, handled: true }
      } catch (errorHandlerError) {
        exception = normalizeRuntimeError(errorHandlerError)
      }
    }

    if (isDefaultRoutable(exception)) {
      context.io.stderr.write(`${exception.message}\n`)
      return { exception, handled: true }
    }
    return { exception, handled: false }
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
          instance: scope.instance,
          kind: scope.kind,
          name: scope.name,
          owner: scope.owner,
        })
      }
    }

    return faults.concat(await injector.dispose())
  }

  private errorScopes(
    scopes: readonly ActivatedScope[],
    start: ActivatedScope | undefined,
  ): ActivatedScope[] {
    if (!start) return []
    const index = scopes.indexOf(start)
    return index < 0 ? [] : scopes.slice(0, index + 1).reverse()
  }

  private faultErrorScopes(
    scopes: readonly ActivatedScope[],
    fault: LifecycleFault,
  ): ActivatedScope[] {
    const instanceScope = scopes.findLast(scope => scope.instance === fault.instance)
    if (instanceScope) return this.errorScopes(scopes, instanceScope)
    const ownerScope = scopes.find(
      scope => scope.kind === 'module' && scope.owner === fault.owner,
    )
    if (ownerScope) return this.errorScopes(scopes, ownerScope)
    const rootScope = scopes.find(
      scope =>
        scope.kind === 'module' && scope.owner === this.application.graph.root,
    )
    return this.errorScopes(scopes, rootScope)
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
    options: ParsedUserOption,
  ): CommandArgs {
    return Object.freeze({
      inputs: Object.freeze(
        invocation.parsed.positionals.slice(invocation.match.consumed),
      ),
      invokedPath: Object.freeze(invocation.match.invokedPath.slice()),
      options: snapshotOptions(options),
      path: Object.freeze(path.slice()),
      raw: this.argv,
    })
  }
}

const immutableArgv = (argv: readonly string[]): readonly string[] =>
  Object.isFrozen(argv) ? argv : Object.freeze(argv.slice())

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

const normalizeError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error))

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

const isRuntimeMethod = (value: unknown): value is RuntimeMethod =>
  typeof value === 'function'

const deprecationNotice = (subject: string, deprecated: Deprecation): string => {
  const detail = deprecated === true ? '' : ` ${deprecated}`
  return `${subject} is deprecated.${detail}\n`
}
