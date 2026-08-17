import { createTestingApp } from 'func/testing'
import { AppModule } from '../../src/app.module'
import { appName } from '../../src/config'

export const app = createTestingApp(AppModule, {
  appName,
})
