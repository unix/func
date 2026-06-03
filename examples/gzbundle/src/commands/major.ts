import { CommandMajor, CommandRegistry, Handler, Regs } from 'func'
import { execSync } from 'child_process'
import { join } from 'path'
const pkg = require('../../package.json')

// const ex = join(__dirname, '../../../')

@CommandMajor()
export class Major {
  @Handler()
  run() {
    // console.log(ex)
    // execSync(`cd ${ex} && zip -r -D ./gzbundle/archived.zip ./gzbundle/`)
    console.log('ok')
  }

  @Handler({ flag: 'help', alias: 'h', description: 'help' })
  help(@Regs() regs: CommandRegistry) {
    console.log(pkg.name.toUpperCase())
    console.log('')

    regs.commands.forEach(data => {
      console.log(`  ${data.name} <command>${this.showDesc(data.description)}`)
    })

    console.log('')
  }

  @Handler({ flag: 'version', alias: 'v', description: 'version' })
  version() {
    console.log(pkg.version)
  }

  private showDesc(desc?: string): string {
    return desc ? ` --  ${desc}` : ''
  }
}
