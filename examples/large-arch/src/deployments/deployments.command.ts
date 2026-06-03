import {
  Command,
  Flag,
  Handler,
  Value,
} from 'func'
import { DeploymentsService } from './deployments.service'

@Command({
  name: 'deployments',
  alias: 'deploy',
  description: 'manage deployments',
})
export class DeploymentsCommand {
  @Value({
    name: 'env',
    alias: 'e',
    description: 'target environment',
  })
  env = 'staging'

  @Flag({
    description: 'print the plan without deploying',
  })
  dryRun = false

  constructor(private deployments: DeploymentsService) {}

  @Handler()
  status() {
    console.log(this.deployments.status(this.env))
  }

  @Handler({ path: ['release'] })
  release() {
    console.log(this.deployments.release(this.env, this.dryRun))
  }
}
