import { CommandError, Exception } from 'func'
import type { FuncException } from 'func'

@CommandError()
export class ErrorCommand {
  constructor(@Exception() exception: FuncException) {
    console.error(`global:${exception.code}:${exception.message}`)
    exception.preventDefaultPrint()
  }
}
