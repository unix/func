import { Service } from 'func'
import { appName } from '../config'

@Service()
export class ProjectService {
  name() {
    return appName
  }
}
