import { JsonOutput, JsonOutputModule } from 'func/json-output'

process.stdout.write(
  typeof JsonOutput === 'function' && typeof JsonOutputModule === 'function'
    ? 'json-output-entry'
    : 'invalid-json-output-entry',
)
