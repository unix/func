import { FuncModule } from 'func'
import { DeploymentsModule } from './deployments/deployments.module'
import { ReportsModule } from './reports/reports.module'
import { UsersModule } from './users/users.module'

@FuncModule({
  imports: [
    UsersModule,
    ReportsModule,
    DeploymentsModule,
  ],
})
export class AppModule {}
