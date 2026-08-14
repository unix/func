import { ArrayValue, CommandMajor, Context, Enum, Flag, Handler, Value } from 'func'
import { ProjectService } from '../services/project.service.js'

@CommandMajor()
export class MajorCommand {
  @Flag({ name: 'dry-run', alias: 'd', aliases: ['D'] })
  dryRun = false

  @Enum(['dev', 'prod'])
  @Value()
  mode: string = 'dev'

  @ArrayValue({ name: 'tag' })
  tags: string[] = []

  constructor(
    private project: ProjectService,
    private context: Context,
  ) {}

  @Handler()
  run() {
    console.log(
      JSON.stringify({
        dryRun: this.dryRun,
        kind: 'major',
        mode: this.mode,
        project: this.project.name(),
        tags: this.tags,
      }),
    )
  }

  @Handler({ flag: 'help', alias: 'h', aliases: ['?'] })
  help() {
    const commands: string[] = []
    this.context.commands.forEach(command => {
      commands.push(command.path.join(' '))
    })
    commands.sort()
    console.log(`commands:${commands.join(',')}`)
  }
}
