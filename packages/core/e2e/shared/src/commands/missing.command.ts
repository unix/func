import { Args, CommandMissing, Handler } from 'func'
import type { FuncArgs } from 'func'

@CommandMissing()
export class MissingCommand {
  @Handler()
  run(@Args() args: FuncArgs) {
    console.error(`missing:${args.inputs[0]}`)
  }
}
