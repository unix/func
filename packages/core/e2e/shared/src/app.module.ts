import { Module } from 'func'
import type { Exception, OnError } from 'func'
import { commands } from './commands/index.js'
import { ProjectService } from './services/project.service.js'

@Module({
  commands,
  providers: [ProjectService],
})
export class AppModule implements OnError {
  onError(exception: Exception) {
    console.error(`global:${exception.code}:${exception.message}`)
  }
}
