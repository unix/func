import { OptionParams, RegisterCommandParams } from '../interfaces'
export class RegisterProvider {
  static isRegisterProvider: boolean = true

  constructor(
    private _commands: RegisterCommandParams[] = [],
    private _options: OptionParams[] = [],
  ) {}

  get commands(): RegisterCommandParams[] {
    return this._commands
  }

  get options(): OptionParams[] {
    return this._options
  }
}
