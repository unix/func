import { ArrayValue, CommandMajor, Context, Enum, Flag, Handler, Value } from 'func'
import pkg from '../../package.json'
import { appName } from '../config'
import { ProjectService } from '../services/project.service'

const runtimeModes = ['dev', 'prod']

@CommandMajor()
export class Major {
  @Flag({
    alias: 'j',
    description: 'print JSON output',
  })
  json = false

  @Enum(runtimeModes)
  @Value({
    description: 'runtime mode',
    type: String,
  })
  mode = 'dev'

  @ArrayValue({
    name: 'tag',
    description: 'add an output tag',
  })
  tags: string[] = []

  constructor(
    private project: ProjectService,
    private context: Context,
  ) {}

  @Handler()
  run() {
    const data = {
      message: `Welcome to ${this.project.name()}`,
      mode: this.mode,
      tags: this.tags,
    }

    if (this.json) {
      console.log(JSON.stringify(data, null, 2))
      return
    }

    console.log(`${data.message} (${data.mode})`)

    if (!data.tags.length) return

    console.log(`Tags: ${data.tags.join(', ')}`)
  }

  @Handler({ flag: 'help', alias: 'h', description: 'print help' })
  help() {
    console.log(appName)
    console.log('')
    console.log('Usage:')
    console.log(`  ${appName} [options]`)
    console.log(`  ${appName} <command> [options]`)
    console.log('')
    console.log('Commands:')

    this.context.commands.forEach(command => {
      console.log(
        `  ${this.commandLine(command.path.join(' '), command.aliases)}${this.description(command.description)}`,
      )
    })

    console.log('')
    console.log('Options:')
    console.log('  -h, --help       print help')
    console.log('  -v, --version    print version')
    console.log('  -j, --json       print JSON output')
    console.log(`      --mode       runtime mode: ${runtimeModes.join(', ')}`)
    console.log('      --tag        add an output tag')
  }

  @Handler({ flag: 'version', alias: 'v', description: 'print version' })
  version() {
    console.log(pkg.version)
  }

  private commandLine(name: string, aliases: readonly string[]): string {
    if (!aliases.length) return name.padEnd(16)

    return [name, ...aliases].join(', ').padEnd(16)
  }

  private description(description?: string): string {
    return description ? description : ''
  }
}
