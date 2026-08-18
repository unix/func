import { createCompiledApp } from './bootstrap'
import type { App, AppOptions } from './bootstrap'
import { compileApplication } from './compiler'
import type { Type } from '../di/types'

export type { App, AppOptions, BootstrapOptions } from './bootstrap'

export const createApp = (input: Type, options: AppOptions = {}): App =>
  createCompiledApp(compileApplication(input, options), options)
