import { Module } from 'func'
import { UsersCommand } from './users.command'
import { UsersService } from './users.service'

@Module({
  commands: [UsersCommand],
  providers: [UsersService],
})
export class UsersModule {}
