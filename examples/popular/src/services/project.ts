import { Service } from 'func'
import pkg from '../../package.json'

@Service()
export class ProjectService {
  name() {
    return pkg.name
  }
}
