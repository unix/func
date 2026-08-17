import { Chalk, supportsColorStderr } from 'chalk'
import type { ChalkInstance, ColorSupportLevel } from 'chalk'
import { Context, Injectable } from 'func'
import type { Writable } from 'node:stream'

@Injectable()
export class ChalkService {
  static ColorLevel(stream: Writable): ColorSupportLevel {
    if (stream === process.stderr)
      return supportsColorStderr ? supportsColorStderr.level : 0
    if ('isTTY' in stream && stream.isTTY === true) return 1
    return 0
  }

  private readonly style: ChalkInstance

  constructor(private readonly context: Context) {
    this.style = new Chalk({ level: ChalkService.ColorLevel(context.io.stderr) })
  }

  success(message: string): void {
    this.context.io.stderr.write(`${this.style.green('✔')} ${message}\n`)
  }

  result(value: unknown): void {
    this.context.io.stdout.write(`${JSON.stringify(value)}\n`)
  }
}
