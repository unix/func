import { FuncModule } from 'func'
import { commands } from './commands/index.js'
import { ProjectService } from './services/project.service.js'

@FuncModule({
  commands,
  services: [ProjectService],
})
export class AppModule {}
