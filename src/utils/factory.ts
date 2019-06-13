import arg from 'arg'
import * as services from '../services'
import * as filter from './filter'
import { metadata } from '../constants/metadata'
import { CommandClass, OptionClass } from '../interfaces'

const serviceFunctions = Object.keys(services)
  .map(key => services[key])

export interface FactoryParams {
  args: arg.Result<any>,
  nativeOption: { [key: string]: string },
  commands: CommandClass[],
  options: OptionClass[],
}

export class Factory {
  constructor(
    private params: FactoryParams,
  ) {
  }
  
  getServiceParams(fn: Function, value?: any): any[] {
    const paramTypes = Reflect.getMetadata(metadata.DESIGN_PARAM_TYPES, fn) || []
    const args = this.params.args
    const option = this.params.nativeOption
  
    return paramTypes.map(type => {
      const fn = serviceFunctions.find(item => item === type)
      if (!fn) return undefined
      if (!fn.isRegisterProvider) return new fn(args._, option, args, value)
      
      const cDatas = filter.commandsToDatas(this.params.commands)
      const oDatas = filter.optionsToDatas(this.params.options)
      return new fn(cDatas, oDatas)
    })
  }
}

