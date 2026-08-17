import { Context, Injectable } from 'func'
import { render } from 'ink'
import type { Readable, Writable } from 'node:stream'
import type { ReactNode } from 'react'

@Injectable()
export class InkService {
  static IsTTY(stream: Readable): stream is NodeJS.ReadStream
  static IsTTY(stream: Writable): stream is NodeJS.WriteStream
  static IsTTY(stream: Readable | Writable): boolean {
    if (!('isTTY' in stream) || stream.isTTY !== true) return false
    return (
      ('setRawMode' in stream && typeof stream.setRawMode === 'function') ||
      ('cursorTo' in stream && typeof stream.cursorTo === 'function')
    )
  }

  constructor(private readonly context: Context) {}

  async render(node: ReactNode): Promise<void> {
    const { stdin, stderr } = this.context.io
    if (!InkService.IsTTY(stdin) || !InkService.IsTTY(stderr)) {
      throw new TypeError('Interactive rendering requires TTY stdin and stderr.')
    }

    const application = render(node, {
      stdin,
      stdout: stderr,
      stderr,
      exitOnCtrlC: false,
      patchConsole: false,
    })
    const unmount = () => application.unmount()
    this.context.signal.addEventListener('abort', unmount, { once: true })

    try {
      await application.waitUntilExit()
    } finally {
      this.context.signal.removeEventListener('abort', unmount)
      application.unmount()
    }
  }
}
