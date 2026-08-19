import {
  Args,
  Command,
  CommandMajor,
  Ctx,
  Handler,
  Module,
  OptionCommand,
  Stdout,
  type Args as CommandArgs,
  type Context,
} from '../../../../../packages/core/src'
import { HelpContext } from '../../../../../packages/core/src/subpath/help/context'
import { HelpFormatter } from '../../../../../packages/core/src/subpath/help/formatter'
import type { HelpMeta } from '../../../../../packages/core/src/subpath/help/interfaces'
import type { Writable } from './terminal-stream'

@OptionCommand({
  alias: 'h',
  description: 'show help',
  name: 'help',
})
class TerminalDemoHelpOption {
  @Handler()
  private async handle(
    @Args() args: CommandArgs,
    @Ctx() context: Context,
    @Stdout() stdout: Writable,
  ): Promise<HelpMeta> {
    const helpContext = new HelpContext(args, context)
    const meta = helpContext.createMeta()
    stdout.write(HelpFormatter.format(meta))
    return meta
  }
}

@Command({ alias: 'g', description: 'print a greeting', path: 'greet' })
class GreetCommand {
  @Handler()
  run() {}
}

@CommandMajor()
class HelpCommand {
  @Handler()
  run() {
    console.log('Welcome to ship (development)')
  }
}

@Module({
  commands: [HelpCommand, GreetCommand],
  options: [TerminalDemoHelpOption],
})
export class GuideHelpModule {}
