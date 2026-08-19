import { Writable } from 'node:stream'

export type OutputChannel = 'stderr' | 'stdout'

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
  private deferredStages = new Map<symbol, number>()
  private destinations: Record<OutputChannel, Writable>
  private settled = false

  constructor(stdout: Writable, stderr: Writable, suppressStdout = false) {
    this.destinations = { stderr, stdout }
    this.stderr = stderr
    this.stdout = suppressStdout ? this.suppressedStdout() : stdout
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
    this.clearDeferred()
  }

  stage(key: symbol, channel: OutputChannel, chunk: string | Uint8Array): boolean {
    if (this.settled) return false
    const staged = { channel, chunk }
    const index = this.deferredStages.get(key)
    if (index !== undefined) {
      this.deferred[index] = staged
      return true
    }

    this.deferredStages.set(key, this.deferred.length)
    this.deferred.push(staged)
    return true
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
        this.clearDeferred()
      },
    })
  }

  private suppressedStdout(): Writable {
    return new Writable({
      write: (
        chunk: string | Uint8Array,
        encoding: BufferEncoding,
        callback: (error?: Error | null) => void,
      ) => {
        void chunk
        void encoding
        callback()
      },
    })
  }

  private commitDeferred(): void {
    const deferred = this.deferred
    this.clearDeferred()
    deferred.forEach(({ channel, chunk }) => {
      this.destinations[channel].write(chunk)
    })
  }

  private clearDeferred(): void {
    this.deferred = []
    this.deferredStages.clear()
  }
}

export const settleOutput = (output: OutputHost): OutputSettlement =>
  output[settleOutputKey]()
