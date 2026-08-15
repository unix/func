import {
  Args,
  ArrayString,
  Command,
  CommandMajor,
  CommandMissing,
  Context,
  DependsOn,
  Enum,
  Exclusive,
  Flag,
  Module,
  Handler,
  Injectable,
  Required,
  Value,
  ValueValidate,
  run,
} from 'func'
import type {
  Args as CommandArgs,
  Exception,
  ExceptionContext,
  OnError,
} from 'func'
import { projectName } from './config'

@Injectable()
class ProjectService {
  name() {
    return projectName
  }
}

@CommandMajor()
class MajorCommand {
  @Flag({ name: 'dry-run', alias: 'd', aliases: ['D'] })
  dryRun = false

  @Enum(['dev', 'prod'])
  @Value()
  mode: string = 'dev'

  @ArrayString({ name: 'tag' })
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
    const commands = this.context.commands
      .map(command => command.path.join(' '))
      .sort()
    console.log(`commands:${commands.join(',')}`)
  }
}

@Command({
  path: 'greet',
  alias: 'g',
  aliases: ['hello'],
  description: 'print a greeting',
})
class GreetCommand {
  @Value({ alias: 'n', aliases: ['N'] })
  name: string = 'friend'

  @Flag({ alias: 'u', aliases: ['U'] })
  upper = false

  @Handler()
  run(@Args() args: CommandArgs) {
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

@Command('async')
class AsyncCommand {
  constructor(private project: ProjectService) {}

  @Handler()
  async run() {
    await Promise.resolve()
    console.log(`async:${this.project.name()}`)
  }
}

@Command('deploy')
class DeployCommand implements OnError {
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

  onError(exception: Exception, context: ExceptionContext) {
    console.error(`local:${exception.code}:${exception.message}`)
    context.preventDefaultPrint()
  }
}

@CommandMissing()
class MissingCommand {
  @Handler()
  run(@Args() args: CommandArgs) {
    console.error(`missing:${args.inputs[0]}`)
  }
}

@Module({
  commands: [GreetCommand, AsyncCommand, DeployCommand],
  exports: [ProjectService],
  providers: [ProjectService],
})
class FeatureModule {}

@Module({
  commands: [MajorCommand, MissingCommand],
  imports: [FeatureModule],
})
class AppModule implements OnError {
  onError(exception: Exception, context: ExceptionContext) {
    console.error(`global:${exception.code}:${exception.message}`)
    context.preventDefaultPrint()
  }
}

run(AppModule).catch(error => {
  console.error(error)
  throw error
})
