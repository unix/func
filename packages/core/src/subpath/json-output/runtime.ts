import { RUNTIME } from '@func/contracts/core-errors'
import { stripVTControlCharacters } from 'node:util'
import { Inject, Injectable } from '../../di/decorators'
import type { Context } from '../../runtime/context'
import type { CallHandler, Interceptor } from '../../runtime/enhancers'
import { OutputHost } from '../../runtime/output'
import { hasJsonOutputOption, JSON_OUTPUT_OPTIONS } from './options'
import type { JsonOutputOptions } from './options'
import { ErrorScope, InternalException } from '../../shared/errors'

@Injectable()
export class JsonOutputInterceptor implements Interceptor {
  constructor(
    @Inject(OutputHost) private readonly output: OutputHost,
    @Inject(JSON_OUTPUT_OPTIONS) private readonly options: JsonOutputOptions,
  ) {}

  async intercept(context: Context, next: CallHandler): Promise<unknown> {
    const json = context.options.json === true || hasJsonOutputOption(context.argv)
    const suppression =
      json && this.options.suppressStdout ? this.output.suppress() : undefined
    let result: unknown

    try {
      result = await next.handle()
    } finally {
      suppression?.close()
    }

    if (!json && context.resultOutput === 'stdout') return result
    const rendered = json ? jsonOutput(result) : textOutput(result)
    if (rendered !== undefined) this.output.defer('stdout', rendered)
    return result
  }
}

const jsonOutput = (value: unknown): string => {
  if (value === undefined) {
    throw outputError(
      'JSON output requires the selected handler to return a value. Return null for an empty result.',
    )
  }

  let serialized: unknown
  try {
    serialized = JSON.stringify(
      value,
      (_key, item: unknown) =>
        typeof item === 'string' ? stripVTControlCharacters(item) : item,
      2,
    )
  } catch (error) {
    throw outputError(
      'The handler result could not be serialized as JSON.',
      nativeError(error),
    )
  }
  if (typeof serialized === 'string') return `${serialized}\n`
  throw outputError('The handler result is not JSON serializable.')
}

const textOutput = (value: unknown): string | undefined => {
  if (value === undefined) return undefined
  if (typeof value === 'string') return withNewline(value)
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'number'
  ) {
    return `${String(value)}\n`
  }

  let serialized: unknown
  try {
    serialized = JSON.stringify(value, null, 2)
  } catch (error) {
    throw outputError(
      'The handler result could not be rendered as text.',
      nativeError(error),
    )
  }
  return typeof serialized === 'string'
    ? `${serialized}\n`
    : withNewline(String(value))
}

const outputError = (message: string, cause?: Error): InternalException =>
  new InternalException(RUNTIME.OUTPUT_SERIALIZATION, {
    ...(cause ? { cause } : {}),
    message,
    scope: ErrorScope.RUNTIME,
  })

const nativeError = (error: unknown): Error | undefined =>
  error instanceof Error ? error : undefined

const withNewline = (value: string): string =>
  value.endsWith('\n') ? value : `${value}\n`
