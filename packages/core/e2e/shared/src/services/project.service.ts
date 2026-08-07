import { Service } from 'func'

@Service()
export class ProjectService {
  name() {
    return 'func-core-e2e'
  }
}
