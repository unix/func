export class CommandErrorProvider {
  static isCommandErrorProvider: boolean = true

  constructor(private _error: Error) {}

  get error(): Error {
    return this._error
  }

  get message(): string {
    return this._error.message
  }

  get code(): string | undefined {
    return (this._error as any).code
  }

  get details(): any {
    return (this._error as any).details
  }
}
