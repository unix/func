import { Module } from '../../application/definition'
import type { ModuleMetadata } from '../../application/definition'
import { jsonOutputModuleMetadata } from './definition'
import type { JsonOutputModuleOptions } from './interfaces'

@Module(jsonOutputModuleMetadata({}))
export class JsonOutputModule {
  // Configurable module APIs conventionally use register().
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static register(options: JsonOutputModuleOptions = {}): ModuleMetadata {
    return jsonOutputModuleMetadata(options)
  }
}
