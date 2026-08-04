import { Command, FuncModule, Handler } from '../../../../core/src'

@Command({
  name: 'status',
  description: 'Print service status',
})
class StatusCommand {
  @Handler()
  run() {
    console.log('All systems operational')
  }
}

@FuncModule({
  commands: [StatusCommand],
})
export class GuideStatusModule {}
