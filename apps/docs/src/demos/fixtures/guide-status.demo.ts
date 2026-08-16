import { Command, Module, Handler } from '../../../../../packages/core/src'

@Command({
  path: 'status',
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
