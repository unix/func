import {
  Args,
  ArrayValue,
  CommandMajor,
  Enum,
  Handler,
  Regs,
  SubOptions,
  Value,
} from 'func'
import type { CommandRegistry, FuncArgs } from 'func'
import { ProjectService } from '../services/project.service.js'

@CommandMajor()
@SubOptions([{ name: 'dry-run', alias: 'd' }])
export class MajorCommand {
  @Enum(['dev', 'prod'])
  @Value()
  mode: string = 'dev'

  @ArrayValue({ name: 'tag' })
  tags: string[] = []

  constructor(private project: ProjectService) {}

  @Handler()
  run(@Args() args: FuncArgs) {
    console.log(
      JSON.stringify({
        dryRun: Boolean(args.native['--dry-run']),
        kind: 'major',
        mode: this.mode,
        project: this.project.name(),
        tags: this.tags,
      }),
    )
  }

  @Handler({ flag: 'help', alias: 'h' })
  help(@Regs() registry: CommandRegistry) {
    const commands = registry.commands.map(command => command.name).sort()
    console.log(`commands:${commands.join(',')}`)
  }
}
