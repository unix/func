import { OptionParams, CommandParams } from '../interfaces'

export class RegisterProvider {
  static isRegisterProvider: boolean = true
  
  constructor(
    private _commands: CommandParams[] = [],
    private _options: OptionParams[] = [],
  ) {
  }
  
  get commands(): CommandParams[] {
    return this._commands
  }
  
  get options(): OptionParams[] {
    return this._options
  }
  
}
