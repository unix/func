import { FuncModule } from 'func'
import { commands } from './commands'
import { services } from './services'

@FuncModule({
  commands,
  services,
})
export class AppModule {}
