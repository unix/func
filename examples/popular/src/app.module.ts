import { Module } from 'func'
import { Major } from './commands/major.command'

@Module({
  commands: [Major],
})
export class AppModule {}
