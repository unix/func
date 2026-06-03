import {
  Command,
  Handler,
  Value,
} from 'func'
import { ReportsService } from './reports.service'

@Command({
  name: 'reports',
  description: 'generate reports',
})
export class ReportsCommand {
  @Value({
    name: 'period',
    alias: 'p',
    description: 'report period',
  })
  period = 'week'

  constructor(private reports: ReportsService) {}

  @Handler()
  summary() {
    console.log(this.reports.summary(this.period))
  }

  @Handler({ path: ['export'] })
  export() {
    console.log(this.reports.export(this.period))
  }
}
