import {
  Args,
  Command,
  Flag,
  Handler,
  Value,
} from 'func'
import type { FuncArgs } from 'func'

@Command({
  name: 'greet',
  alias: 'g',
  description: 'print a greeting',
})
export class Greet {
  @Value({
    name: 'name',
    alias: 'n',
    description: 'name to greet',
  })
  name = 'friend'

  @Flag({
    alias: 'u',
    description: 'print with uppercase letters',
  })
  upper = false

  @Handler()
  run(@Args() args: FuncArgs) {
    this.print(`Hello, ${this.name}!`)

    if (!args.inputs.length) return

    this.print(`Extra input: ${args.inputs.join(' ')}`)
  }

  @Handler({ path: ['shout'] })
  shout() {
    this.print(`HELLO, ${this.name.toUpperCase()}!`)
  }

  private print(message: string) {
    console.log(this.upper ? message.toUpperCase() : message)
  }
}
