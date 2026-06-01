import readline from 'readline'

const frames = ['-', '\\', '|', '/']

export const color = {
  green: (text: string): string => colorText(32, text),
  red: (text: string): string => colorText(31, text),
}

export interface PromptSessionOptions {
  input?: NodeJS.ReadStream
  output?: NodeJS.WriteStream
}

export class PromptSession {
  private input: NodeJS.ReadStream
  private output: NodeJS.WriteStream

  constructor(options: PromptSessionOptions = {}) {
    this.input = options.input || process.stdin
    this.output = options.output || process.stdout
  }

  async text(message: string): Promise<string> {
    return this.question(`${message}: `)
  }

  writeLine(text: string = ''): void {
    this.output.write(`${text}\n`)
  }

  private question(message: string): Promise<string> {
    const rl = readline.createInterface({
      input: this.input,
      output: this.output,
    })

    return new Promise(resolve => {
      rl.question(message, answer => {
        rl.close()
        resolve(answer)
      })
    })
  }
}

export class Loading {
  private currentText = ''
  private frameIndex = 0
  private stream: NodeJS.WriteStream
  private timer: ReturnType<typeof setInterval> | undefined

  constructor(stream: NodeJS.WriteStream = process.stderr) {
    this.stream = stream
  }

  start(text: string): void {
    this.stopTimer()
    this.currentText = text
    this.frameIndex = 0

    if (!this.isInteractive()) {
      this.stream.write(`> ${text}\n`)
      return
    }

    this.render()
    this.timer = setInterval(() => this.render(), 80)
    this.timer.unref()
  }

  succeed(): void {
    if (!this.currentText) return

    const text = this.currentText
    this.stopTimer()

    if (this.isInteractive()) {
      this.clearCurrentLine()
    }

    this.stream.write(`> ${text} done\n`)
    this.currentText = ''
  }

  fail(): void {
    if (!this.currentText) return

    const text = this.currentText
    this.stopTimer()

    if (this.isInteractive()) {
      this.clearCurrentLine()
    }

    this.stream.write(`> ${text} failed\n`)
    this.currentText = ''
  }

  private clearCurrentLine(): void {
    this.stream.clearLine(0)
    this.stream.cursorTo(0)
  }

  private isInteractive(): boolean {
    return Boolean(this.stream.isTTY)
  }

  private render(): void {
    if (!this.currentText || !this.isInteractive()) return

    this.clearCurrentLine()
    this.stream.write(`> ${frames[this.frameIndex]} ${this.currentText}`)
    this.frameIndex = (this.frameIndex + 1) % frames.length
  }

  private stopTimer(): void {
    if (!this.timer) return

    clearInterval(this.timer)
    this.timer = undefined
  }
}

const colorText = (code: number, text: string): string => {
  return `\u001b[${code}m${text}\u001b[0m`
}
