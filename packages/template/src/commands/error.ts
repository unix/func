import {
  CatchAll,
  Exception,
} from 'func'
import type { FuncException } from 'func'

@CatchAll()
export class ErrorHandler {
  constructor(@Exception() exception: FuncException) {
    if (exception.level !== 'runtime-print') return

    console.error(exception.message)
    exception.preventDefaultPrint()
  }
}
