import { APP_FILTER, Catch, Module } from 'func'
import type { Exception, ExceptionFilter } from 'func'
import { commands } from './commands/index.js'
import { ProjectService } from './services/project.service.js'

@Catch()
class AppFilter implements ExceptionFilter {
  catch(exception: Exception) {
    console.error(`global:${exception.code}:${exception.message}`)
  }
}

@Module({
  commands,
  providers: [ProjectService, { provide: APP_FILTER, useClass: AppFilter }],
})
export class AppModule {}
