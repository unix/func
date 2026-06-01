const color = (code: number, text: string): string => {
  return `\u001b[${code}m${text}\u001b[0m`
}

export const cyanColor = (text: string): string => {
  return color(96, text)
}
