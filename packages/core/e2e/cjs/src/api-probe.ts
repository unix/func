import { Container, createApp } from 'func'
import type { ContainerOptions } from 'func'
import { AppModule } from './app.module.js'

const options: ContainerOptions = {
  argv: ['greet', '--name', 'probe'],
}
const app = createApp(AppModule, options)

if (!(app instanceof Container)) {
  throw new Error('createApp did not return a Container')
}

console.log(require.resolve('func'))
app.run()
