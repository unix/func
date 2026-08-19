import { createApp } from 'func'
import { AppModule } from './app.module'

const app = createApp(AppModule, { appName: 'create-func' })

void app.bootstrap()
