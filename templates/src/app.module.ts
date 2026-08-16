import { ErrorScope, Module, Stderr } from 'func'
import type { Exception, ExceptionContext, OnError } from 'func'
import { HelpOption } from 'func/help'
import { commands } from './commands'
import { providers } from './services'
import type { Writable } from 'node:stream'

@Module({
  commands,
  options: [HelpOption],
  providers,
})
export class AppModule implements OnError {
  constructor(@Stderr() private readonly stderr: Writable) {}

  onError(exception: Exception, context: ExceptionContext) {
    if (exception.scope !== ErrorScope.RUNTIME_PRINT) return
    this.stderr.write(`${exception.message}\n`)
    context.preventDefaultPrint()
  }
}
