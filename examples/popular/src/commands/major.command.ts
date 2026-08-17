import { CommandMajor, Handler, Stdout } from 'func'
import type { Writable } from 'node:stream'

@CommandMajor()
export class Major {
  @Handler()
  run(@Stdout() stdout: Writable) {
    stdout.write('Welcome to popular\n')
  }
}
