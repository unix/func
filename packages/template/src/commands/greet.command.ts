import { Args, Command, Flag, Handler, Value } from 'func'
import type { Args as CommandArgs } from 'func'

@Command({
  path: 'greet',
  alias: 'g',
  aliases: ['hello'],
  description: 'print a greeting',
})
export class Greet {
  @Value({
    name: 'name',
    alias: 'n',
    aliases: ['N'],
    description: 'name to greet',
    type: String,
  })
  name = 'friend'

  @Flag({
    alias: 'u',
    aliases: ['U'],
    description: 'print with uppercase letters',
  })
  upper = false

  @Handler()
  run(@Args() args: CommandArgs) {
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
