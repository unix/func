import { createApp } from 'func'
import { AppModule } from './app.module.js'

const app = createApp(AppModule, { appName: 'func-core-e2e' })

void app.bootstrap()
