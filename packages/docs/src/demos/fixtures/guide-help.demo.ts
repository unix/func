import { CommandMajor, FuncModule, Handler } from '../../../../core/src'

@CommandMajor()
class HelpCommand {
  @Handler()
  run() {
    console.log('Welcome to ship (development)')
  }

  @Handler({ flag: 'help', alias: 'h', description: 'print help' })
  help() {
    console.log(`ship

Usage:
  ship [options]
  ship <command> [options]

Commands:
  greet, g        print a greeting

Options:
  -h, --help      print help
  -v, --version   print version`)
  }
}

@FuncModule({
  commands: [HelpCommand],
})
export class GuideHelpModule {}
