import { RUNTIME } from '@func/contracts/core-errors'
import { Injectable } from '../../di/decorators'
import { OutputHost } from '../../runtime/output'
import { ErrorScope, InternalException } from '../../shared/errors'

const outputKey = Symbol('func.json-output')

@Injectable()
export class JsonOutput {
  private outputUsed = false

  constructor(
    private readonly enabled: boolean,
    private readonly output: OutputHost,
  ) {}

  get used(): boolean {
    return this.outputUsed
  }

  json(value: unknown): void {
    if (!this.enabled) return
    if (this.output.stage(outputKey, 'stdout', serialize(value))) {
      this.outputUsed = true
    }
  }
}

export const hasJsonOutputOption = (argv: readonly string[]): boolean => {
  const separator = argv.indexOf('--')
  const options = separator < 0 ? argv : argv.slice(0, separator)
  return options.some(value => value === '--json' || value.startsWith('--json='))
}

const serialize = (value: unknown): string => {
  if (value === undefined) {
    throw serializationError(
      'JSON output requires a value. Pass null for an empty output.',
    )
  }

  let serialized: unknown
  try {
    serialized = JSON.stringify(value, null, 2)
  } catch (error) {
    throw serializationError(
      'The JSON output could not be serialized.',
      nativeError(error),
    )
  }
  if (typeof serialized === 'string') return `${serialized}\n`
  throw serializationError('The JSON output is not serializable.')
}

const serializationError = (message: string, cause?: Error): InternalException =>
  new InternalException(RUNTIME.OUTPUT_SERIALIZATION, {
    ...(cause ? { cause } : {}),
    message,
    scope: ErrorScope.RUNTIME,
  })

const nativeError = (error: unknown): Error | undefined =>
  error instanceof Error ? error : undefined
