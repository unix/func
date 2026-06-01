import arg from 'arg'
import * as services from '../services'
import * as filter from './filter'
import { metadata } from '../constants/metadata'
import { CommandClass, OptionClass } from '../interfaces'
import { FuncError } from './errors'
import { errorCodes } from '../constants/errors'

const serviceFunctions = Object.keys(services).map(key => services[key])

export interface FactoryParams {
  args: arg.Result<any>
  nativeOption: { [key: string]: string }
  commands: CommandClass[]
  options: OptionClass[]
  inputs?: string[]
}

export class Factory {
  constructor(private params: FactoryParams) {}

  getServiceParams(fn: Function, value?: any, error?: Error): any[] {
    const hasParamTypes = Reflect.hasMetadata(metadata.DESIGN_PARAM_TYPES, fn)
    if (!hasParamTypes && fn.length) {
      throw new FuncError(
        errorCodes.MISSING_PARAM_TYPES,
        `Cannot inject constructor params for "${fn.name}". Please use decorator syntax and enable "emitDecoratorMetadata".`,
        { target: fn.name },
      )
    }

    const paramTypes = Reflect.getMetadata(metadata.DESIGN_PARAM_TYPES, fn) || []
    const args = this.params.args
    const option = this.params.nativeOption
    const inputs = this.params.inputs || args._

    return paramTypes.map(type => {
      const fn = serviceFunctions.find(item => item === type)
      if (!fn) return undefined
      if (fn.isCommandErrorProvider) return new fn(error)
      if (!fn.isRegisterProvider) return new fn(inputs, option, args, value)

      const cDatas = filter.commandsToDatas(this.params.commands)
      const oDatas = filter.optionsToDatas(this.params.options)
      return new fn(cDatas, oDatas)
    })
  }
}
