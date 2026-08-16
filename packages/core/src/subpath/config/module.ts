import { SYSTEM } from '@func/contracts/config-errors'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ModuleMetadata } from '../../application/definition'
import { defineApplicationResources } from '../../application/resources'
import type { Provider } from '../../di/types'
import { InternalException } from '../../shared/errors'
import { isSafePathSegment } from '../../shared/path-segment'
import { configFileOptions } from './file'
import type { ConfigConstructor, ConfigModuleOptions } from './interfaces'
import { bindConfig, isConfigConstructor } from './runtime'

interface ResolvedConfigFile {
  appName: string
  config: ConfigConstructor
  fileName: string
  filePath: string
  maxBytes?: number
  name: string
}

export class ConfigModule {
  // Nest-style dynamic module APIs conventionally use register().
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static register(options: ConfigModuleOptions): ModuleMetadata {
    assertModuleOptions(options)
    const files = options.configs.map(config =>
      resolveConfigFile(options.appName, config),
    )
    assertUniquePaths(files)

    const module: ModuleMetadata = {
      providers: files.flatMap(file => providers(file)),
      exports: options.configs,
    }
    return defineApplicationResources(
      module,
      files.map(file => ({
        duplicateError: () => duplicateFileError(file),
        key: `config-file:${file.filePath}`,
      })),
    )
  }
}

const providers = (file: ResolvedConfigFile): Provider[] => [
  {
    provide: file.config,
    useFactory: () =>
      bindConfig(new file.config(), {
        filePath: file.filePath,
        maxBytes: file.maxBytes,
      }),
  },
]

const resolveConfigFile = (
  appName: string,
  config: ConfigConstructor,
): ResolvedConfigFile => {
  if (!isConfigConstructor(config)) {
    throw new InternalException(
      SYSTEM.DEFINITION,
      'ConfigModule.register() only accepts classes that extend Config().',
    )
  }

  const options = configFileOptions(config)
  assertSafeSegment(options.name, 'Config file name')
  const fileName = `${options.name}.json`

  return {
    appName,
    config,
    fileName,
    filePath: join(homedir(), `.${appName}`, fileName),
    maxBytes: options.maxBytes,
    name: options.name,
  }
}

const assertModuleOptions = (options: unknown) => {
  if (!options || typeof options !== 'object') {
    throw new InternalException(
      SYSTEM.DEFINITION,
      'ConfigModule.register() requires an options object.',
    )
  }
  const appName = 'appName' in options ? options.appName : undefined
  const configs = 'configs' in options ? options.configs : undefined
  assertSafeSegment(appName, 'Config appName')
  if (!Array.isArray(configs) || !configs.length) {
    throw new InternalException(
      SYSTEM.DEFINITION,
      'ConfigModule.register() requires at least one config class.',
    )
  }
}

const assertUniquePaths = (files: ResolvedConfigFile[]) => {
  const paths = new Set<string>()
  files.forEach(file => {
    if (paths.has(file.filePath)) throw duplicateFileError(file)
    paths.add(file.filePath)
  })
}

const duplicateFileError = (file: ResolvedConfigFile) =>
  new InternalException(SYSTEM.DUPLICATE_FILE, {
    details: {
      appName: file.appName,
      fileName: file.fileName,
      name: file.name,
      path: file.filePath,
    },
    message: `Config file "${file.filePath}" is registered more than once.`,
  })

const assertSafeSegment = (value: unknown, label: string) => {
  if (isSafePathSegment(value)) return
  throw new InternalException(SYSTEM.DEFINITION, {
    details: { value },
    message: `${label} must be a safe path segment.`,
  })
}
