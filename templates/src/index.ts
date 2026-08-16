import { createApp } from 'func'
import { withCompletion } from 'func/completion'
import { AppModule } from './app.module'
import { appName } from './config'

const app = createApp(AppModule, {
  features: [withCompletion({ bin: appName })],
})

void app.bootstrap()
