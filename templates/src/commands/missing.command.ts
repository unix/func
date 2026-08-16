import { Args, CommandMissing, Handler, Stderr } from 'func'
import type { Args as CommandArgs } from 'func'
import type { Writable } from 'node:stream'

@CommandMissing()
export class Missing {
  @Handler()
  run(@Args() args: CommandArgs, @Stderr() stderr: Writable) {
    stderr.write(`Unknown command: ${args.inputs[0]}\n`)
    stderr.write('Run with --help to see available commands.\n')
  }
}
