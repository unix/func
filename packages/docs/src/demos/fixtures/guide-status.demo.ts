import { Command, Module, Handler } from '../../../../core/src'

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

@Module({
  commands: [StatusCommand],
})
export class GuideStatusModule {}
