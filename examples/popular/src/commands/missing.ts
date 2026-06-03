import {
  Args,
  CommandMissing,
} from 'func'
import type { FuncArgs } from 'func'

@CommandMissing()
export class Missing {
  constructor(@Args() args: FuncArgs) {
    console.error(`Unknown command: ${args.inputs[0]}`)
    console.error('Run with --help to see available commands.')
  }
}
