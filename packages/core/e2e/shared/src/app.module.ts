import { Module } from 'func'
import type { Exception, ExceptionContext, OnError } from 'func'
import { commands } from './commands/index.js'
import { ProjectService } from './services/project.service.js'

@Module({
  commands,
  providers: [ProjectService],
})
export class AppModule implements OnError {
  onError(exception: Exception, context: ExceptionContext) {
    console.error(`global:${exception.code}:${exception.message}`)
    context.preventDefaultPrint()
  }
}
