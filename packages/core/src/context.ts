import type { RegisterCommandParams } from './interfaces'
import type { FuncError, FuncErrorCode, errorLevels, errorTypes } from './errors'

export class FuncException {
  private defaultPrintPrevented = false

  constructor(private funcError: FuncError) {}

  get code(): FuncErrorCode {
    return this.funcError.code
  }

  get details(): any {
    return this.funcError.details
  }

  get error(): FuncError {
    return this.funcError
  }

  get level(): errorLevels {
    return this.funcError.level
  }

  get message(): string {
    return this.funcError.message
  }

  get printPrevented(): boolean {
    return this.defaultPrintPrevented
  }

  get type(): errorTypes {
    return this.funcError.type
  }

  preventDefaultPrint() {
    this.defaultPrintPrevented = true
  }
}

export class CommandRegistry {
  constructor(private registeredCommands: RegisterCommandParams[] = []) {}

  get commands(): RegisterCommandParams[] {
    return this.registeredCommands
  }
}
