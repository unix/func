import { FuncModule } from 'func'
import { ReportsCommand } from './reports.command'
import { ReportsService } from './reports.service'

@FuncModule({
  commands: [ReportsCommand],
  services: [ReportsService],
})
export class ReportsModule {}
