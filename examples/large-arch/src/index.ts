import { createApp } from 'func'
import { AppModule } from './app.module'

const app = createApp(AppModule)

void app.bootstrap()
