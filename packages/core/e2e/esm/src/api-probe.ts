import { createApp } from 'func'
import type { BootstrapOptions } from 'func'
import { AppModule } from './app.module.js'

const options: BootstrapOptions = {
  argv: ['greet', '--name', 'probe'],
}
const app = createApp(AppModule)

if (typeof app.bootstrap !== 'function') {
  throw new Error('createApp did not return a bootstrap application')
}

console.log(import.meta.resolve('func'))
await app.bootstrap(options)
