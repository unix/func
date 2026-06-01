import arg from 'arg'
import * as filter from '../utils/filter'
import { Factory } from '../utils/factory'
import { metadata } from '../utils/metadata'
import { CommandClass, OptionClass, CommandParams, UserOption } from '../interfaces'
import {
  F_RUNTIME_PRINT,
  createRuntimePrintError,
  errorTypes,
} from '../errors'

export interface DevourData {
  commands: CommandClass[]
  options: OptionClass[]
  missing: CommandClass[]
  majors: CommandClass[]
}

export class Mutation {
  private args!: arg.Result<any>

  constructor(private argv: string[] = process.argv.slice(2)) {}

  devour({ commands, options, missing, majors }: DevourData) {
    const command = this.findCommand(commands)
    const optionDatas = filter.optionsToDatas(options)
    const globalOptions = filter.optionsToKeyValue(optionDatas)
    const commandOptions = this.findSubOptions(command)

    // create arg instance
    const nextOptions = command ? commandOptions : globalOptions
    try {
      this.args = arg(nextOptions, { argv: this.argv, permissive: true })
    } catch (error) {
      throw createRuntimePrintError(
        F_RUNTIME_PRINT.PARSE,
        errorTypes.INPUT,
        error instanceof Error ? error.message : String(error),
        { error },
        error instanceof Error ? error : undefined,
      )
    }
    this.throwUnknownOptions(command)

    // collect native option
    const triggerOptionKeys: string[] = []
    let currentTriggerOptionKey = ''
    const nativeOption = Object.keys(nextOptions).reduce<UserOption>((pre, key) => {
      if (!key.startsWith('--')) return pre
      const nativeKey = filter.removeHyphen(key)
      const hasNativeValue = Object.prototype.hasOwnProperty.call(this.args, key)
      const nativeVal = hasNativeValue ? this.args[key] : undefined
      if (hasNativeValue) {
        triggerOptionKeys.push(nativeKey)
        currentTriggerOptionKey = nativeKey
      }
      return Object.assign({}, pre, { [nativeKey]: nativeVal })
    }, {})

    if (!command && triggerOptionKeys.length > 1) {
      throw createRuntimePrintError(
        F_RUNTIME_PRINT.MULTIPLE_OPTIONS,
        errorTypes.INPUT,
        `Only one global option can be invoked at a time: ${triggerOptionKeys
          .map(key => `--${key}`)
          .join(', ')}.`,
        { options: triggerOptionKeys },
      )
    }

    const factory = new Factory({
      nativeOption,
      args: this.args,
      commands,
      options,
      inputs: command ? this.args._.slice(1) : this.args._,
    })

    // only trigger command
    if (command) {
      const params = factory.getServiceParams(command)
      return new command(...params)
    }

    // only trigger option function
    const currentTriggerOptionFn = options.find(fn => {
      const data = Reflect.getMetadata(metadata.OPTION_IDENTIFIER, fn)
      return data && data.name === currentTriggerOptionKey
    })
    if (currentTriggerOptionFn) {
      const value = nativeOption[currentTriggerOptionKey]
      const params = factory.getServiceParams(currentTriggerOptionFn, value)
      return new currentTriggerOptionFn(...params)
    }

    // contains commands but cannot find a processor
    if (this.args._.length) {
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

  private findSubOptions(command: CommandClass | undefined): arg.Spec {
    if (!command) return {}
    const subs = Reflect.getMetadata(metadata.SUB_OPTION_IDENTIFIER, command)
    return filter.optionsToKeyValue(subs)
  }

  private findCommand(commands: CommandClass[]): CommandClass | undefined {
    const first = this.argv[0]
    if (!first || first.startsWith('-')) return undefined

    return commands.find(item => {
      const data: CommandParams = Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, item)
      if (!data) return false
      return data.name === first || data.alias === first
    })
  }

  private throwUnknownOptions(command: CommandClass | undefined) {
    const options = this.args._.filter((input, index) => {
      if (command && index === 0) return false

      return input.startsWith('-') && input !== '-'
    })
    if (!options.length) return

    throw createRuntimePrintError(
      F_RUNTIME_PRINT.UNKNOWN_OPTION,
      errorTypes.INPUT,
      `Unknown option${options.length > 1 ? 's' : ''}: ${options.join(', ')}.`,
      { options },
    )
  }
}
