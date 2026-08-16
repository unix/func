import { Command, Handler, Stdout, Value } from 'func'
import { ReportsService } from './reports.service'
import type { Writable } from 'node:stream'

@Command({
  path: 'reports',
  description: 'generate reports',
})
export class ReportsCommand {
  @Value({
    name: 'period',
    alias: 'p',
    description: 'report period',
  })
  period: string = 'week'

  constructor(private reports: ReportsService) {}

  @Handler()
  summary(@Stdout() stdout: Writable) {
    stdout.write(`${this.reports.summary(this.period)}\n`)
  }

  @Handler({ path: ['export'] })
  export(@Stdout() stdout: Writable) {
    stdout.write(`${this.reports.export(this.period)}\n`)
  }
}
