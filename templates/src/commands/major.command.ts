import { ArrayString, CommandMajor, Enum, Flag, Handler, Value } from 'func'
import pkg from '../../package.json'
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
  })
  mode: string = 'dev'

  @ArrayString({
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

  @Handler({ flag: 'version', alias: 'v', description: 'print version' })
  version() {
    console.log(pkg.version)
  }
}
