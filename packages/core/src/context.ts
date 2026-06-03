import { RegisterCommandParams } from './interfaces'
import type {
  FuncError,
  FuncErrorCode,
  errorLevels,
  errorTypes,
} from './errors'

export class FuncException {
  private defaultPrintPrevented = false

  constructor(private _error: FuncError) {}

  get code(): FuncErrorCode {
    return this._error.code
  }

  get details(): any {
    return this._error.details
  }

  get error(): FuncError {
    return this._error
  }

  get level(): errorLevels {
    return this._error.level
  }

  get message(): string {
    return this._error.message
  }

  get printPrevented(): boolean {
    return this.defaultPrintPrevented
  }

  get type(): errorTypes {
    return this._error.type
  }

  preventDefaultPrint() {
    this.defaultPrintPrevented = true
  }
}

export class CommandRegistry {
  constructor(
    private _commands: RegisterCommandParams[] = [],
  ) {}

  get commands(): RegisterCommandParams[] {
    return this._commands
  }
}
