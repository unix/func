import {
  Args,
  Command,
  CommandMissing,
  FuncModule,
  Handler,
  type FuncArgs,
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
  run(@Args() args: FuncArgs) {
    console.error(`Unknown command: ${args.inputs[0]}`)
  }
}

@FuncModule({
  commands: [StatusCommand, MissingCommand],
})
export class SaasStatusModule {}
