import { Module } from 'func'
import { SharedModule } from '../../shared/shared.module'
import { GreetCommand } from './greet.command'
import { GreetService } from './greet.service'

@Module({
  commands: [GreetCommand],
  imports: [SharedModule],
  providers: [GreetService],
})
export class GreetModule {}
