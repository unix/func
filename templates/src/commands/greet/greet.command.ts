import { Command, Flag, Handler, Stdout, Value } from 'func'
import { OutputService } from '../../shared/services/output.service'
import { GreetService } from './greet.service'
import type { Writable } from 'node:stream'

@Command('greet')
export class GreetCommand {
  @Value({
    name: 'name',
    alias: 'n',
    description: 'name to greet',
  })
  name: string = 'friend'

  @Flag({
    alias: 'u',
    description: 'print with uppercase letters',
  })
  upper = false

  constructor(
    private readonly greetService: GreetService,
    private readonly output: OutputService,
  ) {}

  @Handler()
  run(@Stdout() stdout: Writable) {
    stdout.write(this.output.line(this.greetService.greet(this.name, this.upper)))
  }

  @Handler({ path: ['shout'] })
  shout(@Stdout() stdout: Writable) {
    stdout.write(this.output.line(this.greetService.shout(this.name)))
  }
}
