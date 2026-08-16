import { Args, Command, Flag, Handler, Stdout, Value } from 'func'
import type { Args as CommandArgs } from 'func'
import type { Writable } from 'node:stream'

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
  })
  name: string = 'friend'

  @Flag({
    alias: 'u',
    aliases: ['U'],
    description: 'print with uppercase letters',
  })
  upper = false

  @Handler()
  run(@Args() args: CommandArgs, @Stdout() stdout: Writable) {
    this.print(stdout, `Hello, ${this.name}!`)

    if (!args.inputs.length) return

    this.print(stdout, `Extra input: ${args.inputs.join(' ')}`)
  }

  @Handler({ path: ['shout'] })
  shout(@Stdout() stdout: Writable) {
    this.print(stdout, `HELLO, ${this.name.toUpperCase()}!`)
  }

  private print(stdout: Writable, message: string) {
    stdout.write(`${this.upper ? message.toUpperCase() : message}\n`)
  }
}
