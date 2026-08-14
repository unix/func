import { Module } from 'func'
import { DeploymentsCommand } from './deployments.command'
import { DeploymentsService } from './deployments.service'

@Module({
  commands: [DeploymentsCommand],
  providers: [DeploymentsService],
})
export class DeploymentsModule {}
