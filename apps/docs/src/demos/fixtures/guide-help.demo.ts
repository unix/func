import {
  Command,
  CommandMajor,
  Module,
  Handler,
} from '../../../../../packages/core/src'
import { HelpOption } from '../../../../../packages/core/src/subpath/help'

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
  options: [HelpOption],
})
export class GuideHelpModule {}
