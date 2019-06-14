import { CommandMajor } from 'func'
import { execSync } from 'child_process'
import { join } from 'path'

// const ex = join(__dirname, '../../../')

@CommandMajor()
export class Major {
  constructor() {
    // console.log(ex)
    // execSync(`cd ${ex} && zip -r -D ./gzbundle/archived.zip ./gzbundle/`)
    console.log('ok')
  }
}
