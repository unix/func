import { CommandMajor, Handler, Stdout } from 'func'
import type { Writable } from 'node:stream'

@CommandMajor()
export class MajorCommand {
  @Handler()
  run(@Stdout() stdout: Writable) {
    stdout.write('Welcome to func!\nGitHub: https://github.com/unix/func\n')
  }
}
