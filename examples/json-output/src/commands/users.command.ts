import { Command, Handler, Stdout } from 'func'
import { JsonOutput } from 'func/json-output'
import type { Writable } from 'node:stream'

@Command({
  path: 'users',
  description: 'list users',
})
export class UsersCommand {
  constructor(private readonly output: JsonOutput) {}

  @Handler()
  run(@Stdout() stdout: Writable) {
    const result = {
      users: [
        { id: 1, name: 'Ada' },
        { id: 2, name: 'Grace' },
      ],
    }
    result.users.forEach(user => stdout.write(`${user.id}. ${user.name}\n`))
    this.output.json(result)
  }
}
