import { CommandMajor, Handler, Stdout } from 'func'
import { JsonOutput } from 'func/json-output'
import type { Writable } from 'node:stream'

@CommandMajor()
export class OverviewCommand {
  constructor(private readonly output: JsonOutput) {}

  @Handler()
  run(@Stdout() stdout: Writable) {
    const result = {
      commands: ['status', 'greet', 'users', 'fail'],
      name: 'json-output',
    }
    stdout.write(`Available commands: ${result.commands.join(', ')}\n`)
    this.output.json(result)
  }
}
