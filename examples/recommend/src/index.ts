import { commands } from './commands'
import { FuncModule, run } from 'func'

@FuncModule({
  commands,
})
class AppModule {}

run(AppModule)
