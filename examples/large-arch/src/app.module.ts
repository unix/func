import { Module } from 'func'
import { HelpOption } from 'func/help'
import { DeploymentsModule } from './deployments/deployments.module'
import { ReportsModule } from './reports/reports.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [UsersModule, ReportsModule, DeploymentsModule],
  options: [HelpOption],
})
export class AppModule {}
