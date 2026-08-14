import { Logger, LogModule } from 'func/log'
import type { LogModuleOptions } from 'func/log'

const options: LogModuleOptions = { appName: 'func-core-e2e' }
const module = LogModule.register(options)

if (typeof Logger !== 'function' || module.exports?.[0] !== Logger)
  throw new Error('log subpath is incomplete')

console.log('log-entry')
