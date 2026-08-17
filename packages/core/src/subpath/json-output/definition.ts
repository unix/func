import { SYSTEM } from '@func/contracts/core-errors'
import type { ModuleMetadata } from '../../application/definition'
import { MODULE_INTERCEPTOR, MODULE_OPTION } from '../../runtime/enhancers'
import type { JsonOutputModuleOptions } from './interfaces'
import { JSON_OUTPUT_OPTIONS } from './options'
import type { JsonOutputOptions } from './options'
import { JsonOutputInterceptor } from './runtime'
import { InternalException } from '../../shared/errors'

const jsonOption = Object.freeze({
  aliases: [],
  description: 'print JSON output',
  name: 'json',
  type: Boolean,
})

export const jsonOutputModuleMetadata = (
  options: JsonOutputModuleOptions,
): ModuleMetadata => {
  const normalized = normalizeOptions(options)
  return {
    exports: [JSON_OUTPUT_OPTIONS, MODULE_INTERCEPTOR, MODULE_OPTION],
    name: 'JsonOutputModule',
    providers: [
      {
        provide: JSON_OUTPUT_OPTIONS,
        useValue: normalized,
      },
      {
        provide: MODULE_OPTION,
        useValue: jsonOption,
      },
      {
        provide: MODULE_INTERCEPTOR,
        useClass: JsonOutputInterceptor,
      },
    ],
  }
}

const normalizeOptions = (options: unknown): JsonOutputOptions => {
  if (!options || typeof options !== 'object') {
    throw invalidOptions(options, 'invalid-options')
  }

  return Object.freeze({
    suppressStdout: normalizeSuppressStdout(Reflect.get(options, 'suppressStdout')),
  })
}

const normalizeSuppressStdout = (value: unknown): boolean => {
  if (value === undefined) return true
  if (typeof value === 'boolean') return value
  throw invalidOptions(value, 'invalid-suppress-stdout')
}

const invalidOptions = (value: unknown, reason: string): InternalException =>
  new InternalException(SYSTEM.INVALID_JSON_OUTPUT_MODULE_OPTIONS, {
    details: { reason, value },
  })
