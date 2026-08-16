import { ErrorScope, Module } from 'func'
import type { Exception, ExceptionContext, OnError } from 'func'
import { HelpOption } from 'func/help'
import { commands } from './commands'
import { providers } from './services'

@Module({
  commands,
  options: [HelpOption],
  providers,
})
export class AppModule implements OnError {
  onError(exception: Exception, context: ExceptionContext) {
    if (exception.scope !== ErrorScope.RUNTIME_PRINT) return
    console.error(exception.message)
    context.preventDefaultPrint()
  }
}
