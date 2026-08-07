import {
  Args,
  ArrayValue,
  Catch,
  CatchAll,
  Command,
  CommandMajor,
  CommandMissing,
  DependsOn,
  Enum,
  Exception,
  Exclusive,
  Flag,
  FuncModule,
  Handler,
  Regs,
  Required,
  Service,
  SubOptions,
  Value,
  ValueValidate,
  run,
} from 'func'
import type { CommandRegistry, FuncArgs, FuncException } from 'func'
import { projectName } from './config'

@Service()
class ProjectService {
  name() {
    return projectName
  }
}

@CommandMajor()
@SubOptions([{ name: 'dry-run', alias: 'd' }])
class MajorCommand {
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

@Command({
  name: 'greet',
  alias: 'g',
  description: 'print a greeting',
})
class GreetCommand {
  @Value({ alias: 'n' })
  name: string = 'friend'

  @Flag({ alias: 'u' })
  upper = false

  @Handler()
  run(@Args() args: FuncArgs) {
    const extra = args.inputs.length ? ` ${args.inputs.join(' ')}` : ''
    this.print(`Hello, ${this.name}!${extra}`)
  }

  @Handler({ path: ['shout'] })
  shout() {
    this.print(`HELLO, ${this.name.toUpperCase()}!`)
  }

  private print(message: string) {
    console.log(this.upper ? message.toUpperCase() : message)
  }
}

@Command({ name: 'async' })
class AsyncCommand {
  constructor(private project: ProjectService) {}

  @Handler()
  async run() {
    await Promise.resolve()
    console.log(`async:${this.project.name()}`)
  }
}

@Command({ name: 'deploy' })
class DeployCommand {
  @Required()
  @ValueValidate(value => typeof value === 'string' && value.length >= 3)
  @Value()
  target?: string

  @Value()
  token?: string

  @DependsOn(['token'])
  @Value()
  registry?: string

  @Exclusive(['json'])
  @Flag()
  table = false

  @Flag()
  json = false

  @Handler()
  run() {
    console.log(
      JSON.stringify({
        json: this.json,
        registry: this.registry,
        table: this.table,
        target: this.target,
      }),
    )
  }

  @Catch()
  handleError(@Exception() exception: FuncException) {
    console.error(`local:${exception.code}:${exception.message}`)
    exception.preventDefaultPrint()
  }
}

@CommandMissing()
class MissingCommand {
  @Handler()
  run(@Args() args: FuncArgs) {
    console.error(`missing:${args.inputs[0]}`)
  }
}

@CatchAll()
class GlobalErrorCommand {
  constructor(@Exception() exception: FuncException) {
    console.error(`global:${exception.code}:${exception.message}`)
    exception.preventDefaultPrint()
  }
}

@FuncModule({
  commands: [GreetCommand, AsyncCommand, DeployCommand],
  services: [ProjectService],
})
class FeatureModule {}

@FuncModule({
  commands: [MajorCommand, MissingCommand, GlobalErrorCommand],
  imports: [FeatureModule],
})
class AppModule {}

run(AppModule).catch(error => {
  console.error(error)
  throw error
})
