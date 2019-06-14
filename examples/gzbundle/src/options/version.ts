import { Option } from 'func'
const pkg = require('../../package.json')

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
