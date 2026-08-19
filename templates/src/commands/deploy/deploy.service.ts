import { Injectable } from 'func'

@Injectable()
export class DeployService {
  deploy(endpoint: URL) {
    return `Deploying to ${endpoint.origin}`
  }
}
