import {
  Args,
  Command,
  CommandMissing,
  Module,
  Handler,
  type Args,
} from '../../../../core/src'

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

@CommandMissing()
class MissingCommand {
  @Handler()
  run(@Args() args: Args) {
    console.error(`Unknown command: ${args.inputs[0]}`)
  }
}

@Module({
  commands: [StatusCommand, MissingCommand],
})
export class SaasStatusModule {}
