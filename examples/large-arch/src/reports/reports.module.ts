import { Module } from 'func'
import { ReportsCommand } from './reports.command'
import { ReportsService } from './reports.service'

@Module({
  commands: [ReportsCommand],
  providers: [ReportsService],
})
export class ReportsModule {}
