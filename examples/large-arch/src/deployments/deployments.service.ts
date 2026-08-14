import { Injectable } from 'func'

@Injectable()
export class DeploymentsService {
  status(env: string) {
    return `${env} is healthy`
  }

  release(env: string, dryRun: boolean) {
    if (dryRun) return `planned release to ${env}`

    return `released to ${env}`
  }
}
