import { FuncModule } from 'func'
import { Major } from './commands/major.command'

@FuncModule({
  commands: [Major],
})
export class AppModule {}
