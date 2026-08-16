import { createApp } from 'func'
import { AppModule } from './app.module.js'

const app = createApp(AppModule)

void app.bootstrap()
