import { Args, CommandMissing, Handler } from 'func'
import type { Args as ArgsValue } from 'func'

@CommandMissing()
export class MissingCommand {
  @Handler()
  run(@Args() args: ArgsValue) {
    console.error(`missing:${args.inputs[0]}`)
  }
}
