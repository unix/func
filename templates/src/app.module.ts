import { APP_FILTER, Catch, ErrorScope, Module, Stderr } from 'func'
import type { Exception, ExceptionFilter } from 'func'
import { HelpOption } from 'func/help'
import { commands } from './commands'
import { providers } from './services'
import type { Writable } from 'node:stream'

@Catch(ErrorScope.RUNTIME)
class RuntimeFilter implements ExceptionFilter {
  constructor(@Stderr() private readonly stderr: Writable) {}

  catch(exception: Exception) {
    this.stderr.write(`${exception.message}\n`)
  }
}

@Module({
  commands,
  options: [HelpOption],
  providers: [...providers, { provide: APP_FILTER, useClass: RuntimeFilter }],
})
export class AppModule {}
