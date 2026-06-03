import {
  ArrayValue,
  CommandMajor,
  Enum,
  Flag,
  Handler,
  Regs,
  Value,
} from 'func'
import type { CommandRegistry } from 'func'
import pkg from '../../package.json'
import { ProjectService } from '../services/project'

@CommandMajor()
export class Major {
  @Flag({
    alias: 'j',
    description: 'print JSON output',
  })
  json = false

  @Enum(['dev', 'prod'])
  @Value({
    description: 'runtime mode',
  })
  mode: string = 'dev'

  @ArrayValue({
    name: 'tag',
    description: 'add an output tag',
  })
  tags: string[] = []

  constructor(private project: ProjectService) {}

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
  help(@Regs() regs: CommandRegistry) {
    console.log(pkg.name)
    console.log('')
    console.log('Usage:')
    console.log(`  ${pkg.name} [options]`)
    console.log(`  ${pkg.name} <command> [options]`)
    console.log('')
    console.log('Commands:')

    regs.commands.forEach(command => {
      console.log(
        `  ${this.commandLine(command.name, command.alias)}${this.description(command.description)}`,
      )
    })

    console.log('')
    console.log('Options:')
    console.log('  -h, --help       print help')
    console.log('  -v, --version    print version')
    console.log('  -j, --json       print JSON output')
    console.log('      --mode       runtime mode: dev, prod')
    console.log('      --tag        add an output tag')
  }

  @Handler({ flag: 'version', alias: 'v', description: 'print version' })
  version() {
    console.log(pkg.version)
  }

  private commandLine(name: string, alias?: string): string {
    if (!alias) return name.padEnd(16)

    return `${name}, ${alias}`.padEnd(16)
  }

  private description(description?: string): string {
    return description ? description : ''
  }
}
