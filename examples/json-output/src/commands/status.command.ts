import { Command, Handler, Stdout } from 'func'
import { JsonOutput } from 'func/json-output'
import type { Writable } from 'node:stream'

@Command({
  path: 'status',
  description: 'show service status',
})
export class StatusCommand {
  constructor(private readonly output: JsonOutput) {}

  @Handler()
  run(@Stdout() stdout: Writable) {
    stdout.write('Checking service status...\n')
    this.output.json({
      service: 'api',
      status: 'ready',
    })
  }
}
