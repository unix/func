import { FuncModule } from 'func'
import { UsersCommand } from './users.command'
import { UsersService } from './users.service'

@FuncModule({
  commands: [UsersCommand],
  services: [UsersService],
})
export class UsersModule {}
