import { Module, Stderr } from 'func'
import type { Exception, OnError } from 'func'
import { HelpOption } from 'func/help'
import { JsonOutput, JsonOutputModule } from 'func/json-output'
import type { Writable } from 'node:stream'
import { FailCommand } from './commands/fail.command'
import { GreetCommand } from './commands/greet.command'
import { OverviewCommand } from './commands/overview.command'
import { StatusCommand } from './commands/status.command'
import { UsersCommand } from './commands/users.command'

@Module({
  commands: [
    OverviewCommand,
    StatusCommand,
    GreetCommand,
    UsersCommand,
    FailCommand,
  ],
  imports: [JsonOutputModule],
  options: [HelpOption],
})
export class AppModule implements OnError {
  constructor(
    private readonly output: JsonOutput,
    @Stderr() private readonly stderr: Writable,
  ) {}

  onError(exception: Exception) {
    const error = {
      code: exception.code,
      message: exception.message,
    }
    this.output.json({ error })
    if (this.output.used) return

    this.stderr.write(`${error.message}\n`)
  }
}
