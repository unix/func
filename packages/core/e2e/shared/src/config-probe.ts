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
  appName: 'func-core-e2e',
  configs: [ProbeConfig],
})

if (
  module.exports?.[0] !== ProbeConfig ||
  CONFIG_RUNTIME.UNKNOWN_KEY !== 'UNKNOWN_KEY' ||
  CONFIG_SYSTEM.DEFINITION !== 'DEFINITION'
) {
  throw new Error('config subpath is incomplete')
}

console.log('config-entry')
