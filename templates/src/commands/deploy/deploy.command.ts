import { Command, Handler, Required, Stdout } from 'func'
import { Url } from '../../decorators/url.decorator'
import { OutputService } from '../../shared/services/output.service'
import { DeployService } from './deploy.service'
import type { Writable } from 'node:stream'

@Command('deploy')
export class DeployCommand {
  @Required()
  @Url({ description: 'deployment endpoint' })
  endpoint!: URL

  constructor(
    private readonly deployService: DeployService,
    private readonly output: OutputService,
  ) {}

  @Handler()
  run(@Stdout() stdout: Writable) {
    stdout.write(this.output.line(this.deployService.deploy(this.endpoint)))
  }
}
