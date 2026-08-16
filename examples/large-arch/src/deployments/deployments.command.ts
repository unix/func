import { Command, Flag, Handler, Stdout, Value } from 'func'
import { DeploymentsService } from './deployments.service'
import type { Writable } from 'node:stream'

@Command({
  path: 'deployments',
  alias: 'deploy',
  description: 'manage deployments',
})
export class DeploymentsCommand {
  @Value({
    name: 'env',
    alias: 'e',
    description: 'target environment',
  })
  env: string = 'staging'

  @Flag({
    description: 'print the plan without deploying',
  })
  dryRun = false

  constructor(private deployments: DeploymentsService) {}

  @Handler()
  status(@Stdout() stdout: Writable) {
    stdout.write(`${this.deployments.status(this.env)}\n`)
  }

  @Handler({ path: ['release'] })
  release(@Stdout() stdout: Writable) {
    stdout.write(`${this.deployments.release(this.env, this.dryRun)}\n`)
  }
}
