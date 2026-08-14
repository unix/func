import { createTestingApp } from 'func/testing'
import { AppModule } from './app.module.js'

const app = createTestingApp(AppModule)
app.invoke([]).then(result => {
  if (result.exitCode !== 0)
    throw new Error(`testing invocation exited with ${result.exitCode}`)

  console.log('testing-entry')
})
