import { Module } from 'func'
import { HelpOption } from 'func/help'
import { Major } from './commands/major.command'

@Module({
  commands: [Major],
  options: [HelpOption],
})
export class AppModule {}
