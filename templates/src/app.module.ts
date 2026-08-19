import { Module, Stderr } from 'func'
import type { Exception, OnError } from 'func'
import { HelpOption } from 'func/help'
import type { Writable } from 'node:stream'
import { DeployModule } from './commands/deploy/deploy.module'
import { GreetModule } from './commands/greet/greet.module'
import { MajorCommand } from './commands/major.command'

@Module({
  commands: [MajorCommand],
  imports: [GreetModule, DeployModule],
  options: [HelpOption],
})
export class AppModule implements OnError {
  constructor(@Stderr() private readonly stderr: Writable) {}

  onError(exception: Exception) {
    this.stderr.write(`${exception.message}\n`)
  }
}
