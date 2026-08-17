import { JsonOutputInterceptor, JsonOutputModule } from 'func/json-output'

console.log(
  typeof JsonOutputInterceptor === 'function' &&
    typeof JsonOutputModule === 'function'
    ? 'json-output-entry'
    : 'invalid-json-output-entry',
)
