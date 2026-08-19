import { RUNTIME } from '@func/contracts/core-errors'
import { ErrorScope, InternalException } from './errors'

export interface Environment {
  readonly [name: string]: string | undefined
}

const normalizedEnvironments = new WeakSet<Environment>()

export const environment = {
  normalize(input: Environment): Environment {
    if (normalizedEnvironments.has(input)) return input
    const entries = new Map<string, readonly [name: string, value: string]>()

    Object.entries(input).forEach(([name, value]) => {
      const key = process.platform === 'win32' ? name.toUpperCase() : name
      if (value === undefined) {
        entries.delete(key)
        return
      }
      if (typeof value !== 'string') {
        throw new InternalException(RUNTIME.INVALID_ENVIRONMENT, {
          details: { name, value },
          message: `Environment variable "${name}" must be a string.`,
          scope: ErrorScope.RUNTIME,
        })
      }

      entries.set(key, [name, value])
    })

    const normalized = Object.fromEntries(entries.values())
    Object.setPrototypeOf(normalized, null)
    Object.freeze(normalized)
    normalizedEnvironments.add(normalized)
    return normalized
  },
}
