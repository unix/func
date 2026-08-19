import { SYSTEM } from '@func/contracts/config-errors'
import { join } from 'node:path'
import type { ModuleMetadata } from '../../application/definition'
import type { Provider } from '../../di/types'
import { Context } from '../../runtime/context'
import { InternalException } from '../../shared/errors'
import { applicationDirectory } from '../sub-shared/application-directory'
import { initializeApplicationResource } from '../sub-shared/application-resource'
import { isSafePathSegment } from '../sub-shared/path-segment'
import { configFileOptions } from './file'
import type {
  ConfigConstructor,
  ConfigInstance,
  ConfigModuleOptions,
} from './interfaces'
import { bindConfig, isConfigConstructor } from './runtime'

interface ResolvedConfigFile {
  config: ConfigConstructor
  fileName: string
  maxBytes?: number
  name: string
}

export class ConfigModule {
  // Nest-style dynamic module APIs conventionally use register().
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static register(options: ConfigModuleOptions): ModuleMetadata {
    assertModuleOptions(options)
    const files = options.configs.map(resolveConfigFile)

    return {
      providers: files.map(configProvider),
      exports: options.configs,
    }
  }
}

const configProvider = (file: ResolvedConfigFile): Provider => ({
  inject: [Context],
  provide: file.config,
  useFactory: (context: Context) => initializeConfig(context, file),
})

const initializeConfig = (
  context: Context,
  file: ResolvedConfigFile,
): ConfigInstance => {
  const filePath = configFilePath(context.appName, file.fileName)
  initializeApplicationResource(context, {
    duplicateError: () => duplicateFileError(file, context.appName, filePath),
    key: `config-file:${filePath}`,
  })
  return bindConfig(new file.config(), {
    filePath,
    maxBytes: file.maxBytes,
  })
}

const resolveConfigFile = (config: ConfigConstructor): ResolvedConfigFile => {
  if (!isConfigConstructor(config)) {
    throw new InternalException(SYSTEM.DEFINITION, {
      details: { reason: 'invalid-config-class' },
    })
  }

  const options = configFileOptions(config)
  assertSafeSegment(options.name, 'Config file name')
  const fileName = `${options.name}.json`

  return {
    config,
    fileName,
    maxBytes: options.maxBytes,
    name: options.name,
  }
}

const assertModuleOptions = (options: unknown) => {
  if (!options || typeof options !== 'object') {
    throw new InternalException(SYSTEM.DEFINITION, {
      details: { reason: 'invalid-config-module-options' },
    })
  }
  const configs = 'configs' in options ? options.configs : undefined
  if (!Array.isArray(configs) || !configs.length) {
    throw new InternalException(SYSTEM.DEFINITION, {
      details: { reason: 'missing-config-classes' },
    })
  }
}

const duplicateFileError = (
  file: ResolvedConfigFile,
  appName: string | undefined,
  filePath: string,
) =>
  new InternalException(SYSTEM.DUPLICATE_FILE, {
    details: {
      appName,
      fileName: file.fileName,
      name: file.name,
      path: filePath,
    },
  })

const assertSafeSegment = (value: unknown, label: string) => {
  if (isSafePathSegment(value)) return

  throw new InternalException(SYSTEM.DEFINITION, {
    details: { label, reason: 'unsafe-path-segment', value },
  })
}

const configFilePath = (appName: string | undefined, fileName: string): string =>
  join(applicationDirectory(appName), fileName)
