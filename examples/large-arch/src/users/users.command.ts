import {
  Command,
  Handler,
  Value,
} from 'func'
import { UsersService } from './users.service'

@Command({
  name: 'users',
  description: 'manage users',
})
export class UsersCommand {
  @Value({
    name: 'role',
    alias: 'r',
    description: 'filter users by role',
  })
  role = 'member'

  constructor(private users: UsersService) {}

  @Handler()
  list() {
    console.log(this.users.list(this.role).join('\n'))
  }

  @Handler({ path: ['invite'] })
  invite() {
    console.log(this.users.invite(this.role))
  }
}
