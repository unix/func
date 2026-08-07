import { Command, Handler } from 'func'
import { ProjectService } from '../services/project.service.js'

@Command({ name: 'async' })
export class AsyncCommand {
  constructor(private project: ProjectService) {}

  @Handler()
  async run() {
    await new Promise(resolve => setTimeout(resolve, 10))
    console.log(`async:${this.project.name()}`)
  }
}
