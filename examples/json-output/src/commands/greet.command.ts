import { Command, Handler, Stdout, Value } from 'func'
import { JsonOutput } from 'func/json-output'
import type { Writable } from 'node:stream'

@Command({
  path: 'greet',
  description: 'greet a user',
})
export class GreetCommand {
  constructor(private readonly output: JsonOutput) {}

  @Value({
    name: 'name',
    alias: 'n',
    description: 'name to greet',
  })
  name: string = 'friend'

  @Handler()
  run(@Stdout() stdout: Writable) {
    const result = { message: `Hello, ${this.name}!` }
    stdout.write(`${result.message}\n`)
    this.output.json(result)
  }
}
