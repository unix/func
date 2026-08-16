import { createInvoker } from 'func/invoke'
import { AppModule } from './app.module.js'

const invoker = createInvoker(AppModule)
invoker.invoke([]).then(result => {
  if (result.exitCode !== 0) {
    throw new Error(`invocation exited with ${result.exitCode}`)
  }

  console.log('invoke-entry')
})
