import { UserInputs, UserOption, UserArg } from '../interfaces'

export class CommandArgsProvider {
  constructor(
    private _inputs: UserInputs,
    private _option: UserOption,
    private _native: UserArg,
    private _value: any,
  ) {}

  get inputs(): UserInputs {
    return this._inputs
  }

  get option(): UserOption {
    return this._option
  }

  get native(): UserArg {
    return this._native
  }
}
