import { FuncModule } from 'func'
import { DeploymentsCommand } from './deployments.command'
import { DeploymentsService } from './deployments.service'

@FuncModule({
  commands: [DeploymentsCommand],
  services: [DeploymentsService],
})
export class DeploymentsModule {}
