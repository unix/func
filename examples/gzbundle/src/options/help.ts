import { Option, RegisterProvider } from 'func'
const pkg = require('../../package.json')

@Option({
  name: 'help',
  alias: 'h',
  description: 'help',
})
export class Help {
  
  constructor(
    regs: RegisterProvider,
  ) {
    console.log(pkg.name.toUpperCase())
    console.log('')
  
    regs.commands.forEach(data => {
      console.log(`  ${data.name} \<command\>${this.showDesc(data.description)}`)
    })
  
    console.log('')
  
    regs.options.forEach(data => {
      const alias = data.alias ? ` -${data.alias}` : ''
      console.log(`  --${data.name}${alias} \<option\>${this.showDesc(data.description)}`)
    })
  
    console.log('')
  }
  
  private showDesc(desc: string): string {
    return desc ? ` --  ${desc}` : ''
  }
  
}
