import { Writable } from 'node:stream'

export type OutputChannel = 'stderr' | 'stdout'

export interface OutputScope {
  close(): void
}

interface DeferredOutput {
  channel: OutputChannel
  chunk: string | Uint8Array
}

interface OutputSettlement {
  commit(): void
  rollback(): void
}

const settleOutputKey = Symbol('settleOutput')

export class OutputHost {
  readonly stderr: Writable
  readonly stdout: Writable
  private deferred: DeferredOutput[] = []
  private destinations: Record<OutputChannel, Writable>
  private settled = false
  private stdoutSuppression = 0

  constructor(stdout: Writable, stderr: Writable, manageStdout = false) {
    this.destinations = { stderr, stdout }
    this.stderr = stderr
    this.stdout = manageStdout ? this.managedStdout() : stdout
  }

  defer(channel: OutputChannel, chunk: string | Uint8Array): void {
    if (this.settled) return
    this.deferred.push({ channel, chunk })
  }

  commit(): void {
    if (this.settled) return
    this.commitDeferred()
  }

  rollback(): void {
    if (this.settled) return
    this.deferred = []
  }

  [settleOutputKey](): OutputSettlement {
    this.settled = true
    let active = true

    return Object.freeze({
      commit: () => {
        if (!active) return
        active = false
        this.commitDeferred()
      },
      rollback: () => {
        if (!active) return
        active = false
        this.deferred = []
      },
    })
  }

  suppress(): OutputScope {
    if (this.settled) return Object.freeze({ close: () => {} })
    this.stdoutSuppression += 1
    let active = true

    return Object.freeze({
      close: () => {
        if (!active) return
        active = false
        this.stdoutSuppression -= 1
      },
    })
  }

  private managedStdout(): Writable {
    return new Writable({
      write: (
        chunk: string | Uint8Array,
        encoding: BufferEncoding,
        callback: (error?: Error | null) => void,
      ) => {
        if (this.settled || this.stdoutSuppression > 0) {
          callback()
          return
        }

        this.destinations.stdout.write(chunk, encoding, callback)
      },
    })
  }

  private commitDeferred(): void {
    const deferred = this.deferred
    this.deferred = []
    deferred.forEach(({ channel, chunk }) => {
      this.destinations[channel].write(chunk)
    })
  }
}

export const settleOutput = (output: OutputHost): OutputSettlement =>
  output[settleOutputKey]()
