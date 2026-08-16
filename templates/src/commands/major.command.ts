import { ArrayString, CommandMajor, Enum, Flag, Handler, Stdout, Value } from 'func'
import pkg from '../../package.json'
import { ProjectService } from '../services/project.service'
import type { Writable } from 'node:stream'

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
  run(@Stdout() stdout: Writable) {
    const data = {
      message: `Welcome to ${this.project.name()}`,
      mode: this.mode,
      tags: this.tags,
    }

    if (this.json) {
      stdout.write(`${JSON.stringify(data, null, 2)}\n`)
      return
    }

    stdout.write(`${data.message} (${data.mode})\n`)
    if (!data.tags.length) return
    stdout.write(`Tags: ${data.tags.join(', ')}\n`)
  }

  @Handler({ flag: 'version', alias: 'v', description: 'print version' })
  version(@Stdout() stdout: Writable) {
    stdout.write(`${pkg.version}\n`)
  }
}
