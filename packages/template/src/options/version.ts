import { Option } from 'func'
import pkg from '../../package.json'

@Option({
  name: 'version',
  alias: 'v',
  description: 'version',
})
export class Version {
  constructor() {
    console.log(pkg.version)
  }
}
