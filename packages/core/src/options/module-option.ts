import type { ProviderToken } from '../di/types'
import { createToken } from '../di/token'
import type { OptionParams } from './types'

export const MODULE_OPTION = createToken<OptionParams>('func.module-option')

export const isMultiProviderToken = (token: ProviderToken): boolean =>
  token === MODULE_OPTION
