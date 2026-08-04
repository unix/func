import { styleText } from 'node:util'

const output = process.stdout
const errorOutput = process.stderr

let active = false

const styled = (
  format: Parameters<typeof styleText>[0],
  text: string,
  stream: NodeJS.WritableStream = output,
): string => {
  return styleText(format, text, { stream })
}

const writeLine = (
  text: string = '',
  stream: NodeJS.WritableStream = output,
): void => {
  stream.write(`${text}\n`)
}

export const start = (text: string): void => {
  active = true
  writeLine(`  ${styled('cyan', '◇')} ${styled('bold', text)}`)
}

export const succeed = (text: string): void => {
  if (!active) return

  writeLine(`  ${styled('green', '✓')} ${styled(['green', 'bold'], text)}`)
  active = false
}

export const fail = (text: string): void => {
  if (!active) return

  writeLine(
    `  ${styled('red', '✗', errorOutput)} ${styled(
      ['red', 'bold'],
      text,
      errorOutput,
    )}`,
    errorOutput,
  )
  active = false
}

export const info = (text: string, detail?: string): void => {
  writeLine()
  writeLine(`  ${styled('cyan', '●')} ${styled('bold', text)}`)
  if (!detail) return

  writeLine(`    ${styled('dim', detail)}`)
}

export const error = (text: string, detail?: string): void => {
  writeLine(
    `  ${styled('red', '✗', errorOutput)} ${styled(
      ['red', 'bold'],
      text,
      errorOutput,
    )}`,
    errorOutput,
  )
  if (!detail) return

  writeLine(`    ${styled('red', detail, errorOutput)}`, errorOutput)
}

export const detail = (text: string): void => {
  writeLine(`    ${styled('red', text, errorOutput)}`, errorOutput)
}

export const newline = (): void => {
  writeLine()
}
