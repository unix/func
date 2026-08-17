import {
  Config,
  ConfigFile,
  ConfigModule,
  CONFIG_RUNTIME,
  CONFIG_SYSTEM,
} from 'func/config'

const ProbeConfig = Config({ enabled: true })
ConfigFile({ name: 'probe' })(ProbeConfig)
const module = ConfigModule.register({
  configs: [ProbeConfig],
})
const isExpectedValue = (actual: string, expected: string) => actual === expected

if (
  module.exports?.[0] !== ProbeConfig ||
  !isExpectedValue(CONFIG_RUNTIME.UNKNOWN_KEY, 'UNKNOWN_KEY') ||
  !isExpectedValue(CONFIG_SYSTEM.DEFINITION, 'DEFINITION')
) {
  throw new Error('config subpath is incomplete')
}

console.log('config-entry')
