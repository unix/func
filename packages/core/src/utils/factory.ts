import arg from 'arg'
import * as services from '../services'
import * as filter from './filter'
import { metadata } from './metadata'
import { CommandClass, OptionClass, UserOption } from '../interfaces'
import {
  CommandErrorProvider,
  F_SYSTEM,
  createSystemError,
  errorTypes,
} from '../errors'

interface ServiceFunction {
  isCommandErrorProvider?: boolean
  isRegisterProvider?: boolean
  new (...args: any[]): any
}

const serviceFunctions: ServiceFunction[] = (
  Object.keys(services).map(key => services[key as keyof typeof services]) as ServiceFunction[]
)
  .concat([CommandErrorProvider])

export interface FactoryParams {
  args: arg.Result<any>
  nativeOption: UserOption
  commands: CommandClass[]
  options: OptionClass[]
  inputs?: string[]
}

export class Factory {
  constructor(private params: FactoryParams) {}

  getServiceParams(fn: Function, value?: any, error?: Error | CommandErrorProvider): any[] {
    const hasParamTypes = Reflect.hasMetadata(metadata.DESIGN_PARAM_TYPES, fn)
    if (!hasParamTypes && fn.length) {
      throw createSystemError(
        F_SYSTEM.MISSING_PARAM_TYPES,
        errorTypes.INJECTION,
        `Cannot inject constructor params for "${fn.name}". Please use decorator syntax and enable "emitDecoratorMetadata".`,
        { target: fn.name },
      )
    }

    const paramTypes = Reflect.getMetadata(metadata.DESIGN_PARAM_TYPES, fn) || []
    const args = this.params.args
    const option = this.params.nativeOption
    const inputs = this.params.inputs || args._

    return paramTypes.map((type: Function) => {
      const serviceFunction = serviceFunctions.find(item => item === type)
      if (!serviceFunction) {
        throw createSystemError(
          F_SYSTEM.MISSING_PROVIDER,
          errorTypes.INJECTION,
          `Cannot inject unknown provider "${type.name}" into "${fn.name}".`,
          { provider: type.name, target: fn.name },
        )
      }
      if (serviceFunction.isCommandErrorProvider) {
        if (error instanceof serviceFunction) return error
        return new serviceFunction(error)
      }
      if (!serviceFunction.isRegisterProvider) {
        return new serviceFunction(inputs, option, args, value)
      }

      const cDatas = filter.commandsToDatas(this.params.commands)
      const oDatas = filter.optionsToDatas(this.params.options)
      return new serviceFunction(cDatas, oDatas)
    })
  }
}
