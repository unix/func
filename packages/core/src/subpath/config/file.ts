import { SYSTEM } from '@func/contracts/config-errors'
import { InternalException } from '../../shared/errors'
import type { ConfigConstructor, ConfigFileOptions } from './interfaces'
import { isConfigConstructor } from './runtime'

const configFiles = new WeakMap<ConfigConstructor, ConfigFileOptions>()

export const ConfigFile = (options: ConfigFileOptions): ClassDecorator => {
  assertOptions(options)

  return target => {
    if (!isConfigConstructor(target)) {
      throw new InternalException(SYSTEM.DEFINITION, {
        details: { config: target.name, reason: 'invalid-config-file-target' },
      })
    }

    configFiles.set(target, { ...options })
  }
}

export const configFileOptions = (
  config: ConfigConstructor,
): Readonly<ConfigFileOptions> =>
  configFiles.get(config) ?? {
    name: 'config',
  }

const assertOptions = (options: unknown) => {
  if (!options || typeof options !== 'object') {
    throw new InternalException(SYSTEM.DEFINITION, {
      details: { reason: 'invalid-config-file-options' },
    })
  }
  if (
    !('name' in options) ||
    typeof options.name !== 'string' ||
    !options.name.trim()
  ) {
    throw new InternalException(SYSTEM.DEFINITION, {
      details: { reason: 'invalid-config-file-name' },
    })
  }
  if (
    'maxBytes' in options &&
    options.maxBytes !== undefined &&
    (typeof options.maxBytes !== 'number' ||
      !Number.isSafeInteger(options.maxBytes) ||
      options.maxBytes <= 0)
  ) {
    throw new InternalException(SYSTEM.DEFINITION, {
      details: {
        maxBytes: options.maxBytes,
        reason: 'invalid-config-file-max-bytes',
      },
    })
  }
}
