import { Args, Command, Flag, Handler, Value } from 'func'
import type { FuncArgs } from 'func'

@Command({
  name: 'greet',
  alias: 'g',
  description: 'print a greeting',
})
export class GreetCommand {
  @Value({ alias: 'n' })
  name: string = 'friend'

  @Flag({ alias: 'u' })
  upper = false

  @Handler()
  run(@Args() args: FuncArgs) {
    const extra = args.inputs.length ? ` ${args.inputs.join(' ')}` : ''
    this.print(`Hello, ${this.name}!${extra}`)
  }

  @Handler({ path: ['shout'] })
  shout() {
    this.print(`HELLO, ${this.name.toUpperCase()}!`)
  }

  private print(message: string) {
    console.log(this.upper ? message.toUpperCase() : message)
  }
}
