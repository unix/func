const frames = ['-', '\\', '|', '/']
const stream = process.stderr

let currentText = ''
let frameIndex = 0
let timer: ReturnType<typeof setInterval> | undefined

const isInteractive = (): boolean => {
  return Boolean(stream.isTTY)
}

const clearCurrentLine = (): void => {
  if (!isInteractive()) return

  stream.clearLine(0)
  stream.cursorTo(0)
}

const stopTimer = (): void => {
  if (!timer) return

  clearInterval(timer)
  timer = undefined
}

const writeLine = (text: string): void => {
  if (!isInteractive()) {
    console.log(text)
    return
  }

  stream.write(`${text}\n`)
}

const render = (): void => {
  if (!currentText || !isInteractive()) return

  clearCurrentLine()
  stream.write(`> ${frames[frameIndex]} ${currentText}`)
  frameIndex = (frameIndex + 1) % frames.length
}

export const start = (text: string): void => {
  stopTimer()
  currentText = text
  frameIndex = 0

  if (!isInteractive()) {
    writeLine(`> ${text}`)
    return
  }

  render()
  timer = setInterval(render, 80)
  timer.unref()
}

export const succeed = (clear: boolean = false): void => {
  if (!currentText) return
  stopTimer()

  if (!clear) {
    clearCurrentLine()
    writeLine(`> ${currentText} done`)
    currentText = ''
    return
  }

  clearCurrentLine()
  currentText = ''
}
