import { Service } from 'func'
import { config } from '../config'

@Service()
export class ProjectService {
  name() {
    return config.package.name
  }
}
