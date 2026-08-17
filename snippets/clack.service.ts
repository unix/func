import {
  cancel as renderCancel,
  confirm,
  intro,
  isCancel,
  outro,
  spinner,
  text,
} from '@clack/prompts'
import type { ConfirmOptions, SpinnerOptions, TextOptions } from '@clack/prompts'
import { Context, Injectable } from 'func'
import type { Readable, Writable } from 'node:stream'

type BoundOptions<T> = Omit<T, 'input' | 'output' | 'signal'>

@Injectable()
export class ClackService {
  static IsTTY(stream: Readable | Writable): boolean {
    return 'isTTY' in stream && stream.isTTY === true
  }

  constructor(private readonly context: Context) {}

  get interactive(): boolean {
    return (
      ClackService.IsTTY(this.context.io.stdin) &&
      ClackService.IsTTY(this.context.io.stderr)
    )
  }

  confirm(options: BoundOptions<ConfirmOptions>) {
    return confirm({ ...options, ...this.promptIO() })
  }

  text(options: BoundOptions<TextOptions>) {
    return text({ ...options, ...this.promptIO() })
  }

  spinner(options: BoundOptions<SpinnerOptions> = {}) {
    return spinner({
      ...options,
      output: this.context.io.stderr,
      signal: this.context.signal,
    })
  }

  intro(message: string) {
    intro(message, { output: this.context.io.stderr })
  }

  outro(message: string) {
    outro(message, { output: this.context.io.stderr })
  }

  cancel(message = 'Operation cancelled.') {
    renderCancel(message, { output: this.context.io.stderr })
  }

  isCancelled(value: unknown): value is symbol {
    return isCancel(value)
  }

  async runWithSpinner<T>(message: string, operation: () => Promise<T>) {
    const progress = this.spinner()
    progress.start(message)

    try {
      const result = await operation()
      progress.stop(message)
      return result
    } catch (error) {
      progress.error(message)
      throw error
    }
  }

  private promptIO() {
    if (!this.interactive) {
      throw new TypeError('Interactive prompts require TTY stdin and stderr.')
    }

    return {
      input: this.context.io.stdin,
      output: this.context.io.stderr,
      signal: this.context.signal,
    }
  }
}
