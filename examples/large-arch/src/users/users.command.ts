import { Command, Handler, Stdout, Value } from 'func'
import { UsersService } from './users.service'
import type { Writable } from 'node:stream'

@Command({
  path: 'users',
  description: 'manage users',
})
export class UsersCommand {
  @Value({
    name: 'role',
    alias: 'r',
    description: 'filter users by role',
  })
  role: string = 'member'

  constructor(private users: UsersService) {}

  @Handler()
  list(@Stdout() stdout: Writable) {
    stdout.write(`${this.users.list(this.role).join('\n')}\n`)
  }

  @Handler({ path: ['invite'] })
  invite(@Stdout() stdout: Writable) {
    stdout.write(`${this.users.invite(this.role)}\n`)
  }
}
