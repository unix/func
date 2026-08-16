import { createTestingApp } from 'func/testing'
import { AppModule } from './app.module.js'

const app = createTestingApp(AppModule)
const result = await app.invoke([])
if (result.exitCode !== 0)
  throw new Error(`testing invocation exited with ${result.exitCode}`)

console.log('testing-entry')
