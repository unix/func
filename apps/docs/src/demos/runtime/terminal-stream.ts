type StreamCallback = (error?: Error | null) => void

interface WritableOptions {
  write?: (
    chunk: string | Uint8Array,
    encoding: string,
    callback: StreamCallback,
  ) => void
}

export class Readable {}

export class Writable {
  private readonly writeChunk?: WritableOptions['write']

  constructor(options: WritableOptions = {}) {
    this.writeChunk = options.write
  }

  write(
    chunk: string | Uint8Array,
    encodingOrCallback?: string | StreamCallback,
    callback?: StreamCallback,
  ): boolean {
    const encoding =
      typeof encodingOrCallback === 'string' ? encodingOrCallback : 'utf8'
    const complete =
      typeof encodingOrCallback === 'function'
        ? encodingOrCallback
        : (callback ?? (() => {}))
    if (!this.writeChunk) {
      complete()
      return true
    }

    this.writeChunk(chunk, encoding, complete)
    return true
  }
}
