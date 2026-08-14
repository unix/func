import { Args, CommandMissing, Handler } from 'func'
import type { Args as CommandArgs } from 'func'

@CommandMissing()
export class Missing {
  @Handler()
  run(@Args() args: CommandArgs) {
    console.error(`Unknown command: ${args.inputs[0]}`)
    console.error('Run with --help to see available commands.')
  }
}
