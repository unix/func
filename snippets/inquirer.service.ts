import { input } from '@inquirer/prompts'
import { Context, Injectable } from 'func'
import type { Readable, Writable } from 'node:stream'

type InputOptions = Parameters<typeof input>[0]

@Injectable()
export class InquirerService {
  static IsTTY(stream: Readable | Writable): boolean {
    return 'isTTY' in stream && stream.isTTY === true
  }

  constructor(private readonly context: Context) {}

  input(options: InputOptions) {
    const { stdin, stdout } = this.context.io
    if (!InquirerService.IsTTY(stdin) || !InquirerService.IsTTY(stdout)) {
      throw new TypeError('Interactive prompts require TTY stdin and stdout.')
    }

    return input(options, {
      input: stdin,
      output: stdout,
      signal: this.context.signal,
    })
  }
}
