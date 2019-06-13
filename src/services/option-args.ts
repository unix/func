import { UserArg, UserInputs, UserOption } from '../interfaces'

export class OptionArgsProvider {
  constructor(
    private _inputs: UserInputs,
    private _option: UserOption,
    private _native: UserArg,
    private _value: any,
  ) {
  }
  
  get value(): any {
    return this._value
  }
  
  get native(): UserArg {
    return this._native
  }
}
