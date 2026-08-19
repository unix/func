import { Module } from 'func'
import { SharedModule } from '../../shared/shared.module'
import { DeployCommand } from './deploy.command'
import { DeployService } from './deploy.service'

@Module({
  commands: [DeployCommand],
  imports: [SharedModule],
  providers: [DeployService],
})
export class DeployModule {}
