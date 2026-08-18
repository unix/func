import { createCompiledApp } from '../../application/bootstrap'
import type { App, AppOptions } from '../../application/bootstrap'
import { collectApplicationConfiguration } from '../../shared/application-configuration'
import { hydrateApplicationPlan } from './hydrate'
import type { PrecompiledApplicationPlan } from './plan'

export type { PrecompiledApplicationPlan } from './plan'
export { PRECOMPILED_APPLICATION_ABI } from './plan'

export const createAppFromPlan = (
  plan: PrecompiledApplicationPlan,
  options: AppOptions = {},
): App => {
  const configuration = collectApplicationConfiguration(options)
  return createCompiledApp(
    hydrateApplicationPlan(plan, configuration.appName),
    options,
  )
}
