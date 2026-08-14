import { Args, Command, Flag, Handler, Value } from 'func'
import type { Args as ArgsValue } from 'func'

@Command({
  alias: 'g',
  aliases: ['hello'],
  description: 'print a greeting',
  path: 'greet',
})
export class GreetCommand {
  @Value({ alias: 'n', aliases: ['N'] })
  name: string = 'friend'

  @Flag({ alias: 'u', aliases: ['U'] })
  upper = false

  @Handler()
  run(@Args() args: ArgsValue) {
    const extra = args.inputs.length ? ` ${args.inputs.join(' ')}` : ''
    this.print(`Hello, ${this.name}!${extra}`)
  }

  @Handler('shout')
  shout() {
    this.print(`HELLO, ${this.name.toUpperCase()}!`)
  }

  private print(message: string) {
    console.log(this.upper ? message.toUpperCase() : message)
  }
}
