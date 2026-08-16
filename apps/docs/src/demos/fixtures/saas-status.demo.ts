import {
  Args,
  Command,
  CommandMissing,
  Module,
  Handler,
  type Args as CommandArgs,
} from '../../../../../packages/core/src'

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

@CommandMissing()
class MissingCommand {
  @Handler()
  run(@Args() args: CommandArgs) {
    console.error(`Unknown command: ${args.inputs[0]}`)
  }
}

@Module({
  commands: [StatusCommand, MissingCommand],
})
export class SaasStatusModule {}
