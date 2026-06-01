let currentText = ''

export const start = (text: string): void => {
  currentText = text
  console.log(`> ${text}`)
}

export const succeed = (clear: boolean = false): void => {
  if (!currentText) return
  if (!clear) {
    console.log(`> ${currentText} done`)
  }
  currentText = ''
}
