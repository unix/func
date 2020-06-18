import arg from 'arg'
import * as filter from '../utils/filter'
import { Factory } from '../utils/factory'
import { metadata } from '../constants/metadata'
import { CommandClass, OptionClass, CommandParams } from '../interfaces'

export interface DevourData {
  commands: CommandClass[]
  options: OptionClass[]
  missing: CommandClass[]
  majors: CommandClass[]
}

export class Mutation {
  private args: arg.Result<any>
  
  devour({
    commands, options, missing, majors,
  }: DevourData): void {
    const command = majors.length > 0 ? majors[0] : this.findCommand(commands)
    const optionDatas = filter.optionsToDatas(options)
    const globalOptions = filter.optionsToKeyValue(optionDatas)
    const commandOptions = this.findSubOptions(command)
    
    // create arg instance
    const nextOptions = command ? commandOptions : globalOptions
    this.args = arg(nextOptions, { permissive: true })
    
    // collect native option
    let currnetTriggerOptionKey = ''
    const nativeOption = Object.keys(nextOptions)
      .reduce((pre, key) => {
        if (!key.startsWith('--')) return pre
        const nativeKey = filter.removeHyphen(key)
        const nativeVal = this.args[key] || undefined
        if (nativeVal) {
          currnetTriggerOptionKey = nativeKey
        }
        return Object.assign({}, pre, { [nativeKey]: nativeVal })
      }, {})
  
    const factory = new Factory({
      nativeOption,
      args: this.args,
      commands,
      options,
    })
  
    // only trigger comand
    if (command && majors.length === 0) {
      const params = factory.getServiceParams(command)
      return new command(...params)
    }
    
    // only trigger option function
    const currentTriggerOptionFn = options.find(fn => {
      const data = Reflect.getMetadata(metadata.OPTION_IDENTIFIER, fn)
      return data && data.name === currnetTriggerOptionKey
    })
    if (currentTriggerOptionFn) {
      const value = nativeOption[currnetTriggerOptionKey]
      const params = factory.getServiceParams(currentTriggerOptionFn, value)
      return new currentTriggerOptionFn(...params)
    }
    
    // contains commands but cannot find a processor
    if (this.args._.length > 0 && majors.length === 0) {
      return missing.forEach(missCommand => {
        const params = factory.getServiceParams(missCommand)
        new missCommand(...params)
      })
    }
    
    majors.forEach(majorCommand => {
      const params = factory.getServiceParams(majorCommand)
      new majorCommand(...params)
    })
  }
  
  private findSubOptions(command: CommandClass): { [key: string]: string } {
    if (!command) return {}
    const subs = Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, command)
    return filter.optionsToKeyValue(subs)
  }
  
  private findCommand(commands: CommandClass[]): CommandClass | undefined {
    const inputs = process.argv.slice(2) || []
    const first = inputs[0]
    if (!first || first.startsWith('-')) return undefined
    
    return commands.find(item => {
      const data: CommandParams = Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, item)
      if (!data) return false
      return data.name === first || data.alias === first
    })
  }
  
}


